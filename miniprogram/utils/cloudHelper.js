const { PRESET_DISHES } = require("./defaultData");

// 订单状态枚举定义
const ORDER_STATUS = {
  PENDING: { key: "pending", label: "待接单", badgeColor: "#FF5722", actionLabel: "确认接单" },
  PREPARING: { key: "preparing", label: "备菜中", badgeColor: "#FF9800", actionLabel: "开始烹饪" },
  COOKING: { key: "cooking", label: "下锅热炒", badgeColor: "#E91E63", actionLabel: "烹饪完成上菜" },
  SERVED: { key: "served", label: "已上桌", badgeColor: "#4CAF50", actionLabel: "结束订单" },
  DONE: { key: "done", label: "已完成", badgeColor: "#9E9E9E", actionLabel: "" }
};

class CloudHelper {
  constructor() {
    this.isCloudEnabled = false;
    this.db = null;
    this.watchListener = null;
  }

  init() {
    if (wx.cloud) {
      try {
        wx.cloud.init({
          env: wx.cloud.DYNAMIC_CURRENT_ENV,
          traceUser: true
        });
        this.db = wx.cloud.database();
        this.isCloudEnabled = true;
        console.log("微信云开发初始化成功");
      } catch (err) {
        console.warn("微信云开发未配置环境，已自动启用本地极速存储模式:", err);
        this.isCloudEnabled = false;
      }
    } else {
      console.warn("当前基础库不支持 wx.cloud，启用本地存储模式");
      this.isCloudEnabled = false;
    }

    // 清理旧版本缓存与脏数据
    try {
      wx.removeStorageSync("family_dishes");
      wx.removeStorageSync("dishes");
    } catch (e) {}

    // 初始化本地1077道菜品库（若为空或旧数据则刷新）
    const storedDishes = wx.getStorageSync("lele_dishes_v1077");
    if (!storedDishes || storedDishes.length < 1000) {
      wx.setStorageSync("lele_dishes_v1077", PRESET_DISHES);
    }
  }

  // 严格称呼与文案净化器（确保任何旧数据或缓存中的违禁名称全部动态纠正为臭乐乐）
  sanitizeDish(dish) {
    if (!dish) return dish;
    try {
      let str = JSON.stringify(dish);
      str = str.replace(/朱凯琪/g, "臭乐乐")
               .replace(/凯琪/g, "臭乐乐")
               .replace(/绝绝子/g, "超美味");
      return JSON.parse(str);
    } catch (e) {
      return dish;
    }
  }

  // 获取所有菜品
  async getDishes() {
    if (this.isCloudEnabled && this.db) {
      try {
        const res = await this.db.collection("dishes").limit(100).get();
        if (res.data && res.data.length > 0) {
          return res.data.map(d => this.sanitizeDish(d));
        }
      } catch (e) {
        console.warn("云数据库获取菜品失败，降级读取本地缓存:", e);
      }
    }
    // 本地存储兜底
    const local = wx.getStorageSync("lele_dishes_v1077");
    const list = local && local.length > 0 ? local : PRESET_DISHES;
    return list.map(d => this.sanitizeDish(d));
  }

  // 根据ID获取单个菜品
  async getDishById(id) {
    const list = await this.getDishes();
    return list.find(d => d.id === id) || null;
  }

  // 保存或更新菜品
  async saveDish(dishData) {
    let dishes = await this.getDishes();
    const index = dishes.findIndex(d => d.id === dishData.id);
    if (index >= 0) {
      dishes[index] = { ...dishes[index], ...dishData, updatedAt: Date.now() };
    } else {
      if (!dishData.id) {
        dishData.id = "dish_custom_" + Date.now();
      }
      dishes.unshift({
        ...dishData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        available: dishData.available !== undefined ? dishData.available : true
      });
    }

    wx.setStorageSync("lele_dishes_v1077", dishes);

    // 如果开启云开发，尝试同步写入
    if (this.isCloudEnabled && this.db) {
      try {
        if (index >= 0) {
          await this.db.collection("dishes").doc(dishData.id).update({
            data: dishData
          });
        } else {
          await this.db.collection("dishes").add({
            data: { ...dishData, _id: dishData.id }
          });
        }
      } catch (err) {
        console.warn("云端同步菜品错误:", err);
      }
    }
    return dishData;
  }

  // 删除菜品
  async deleteDish(dishId) {
    let dishes = await this.getDishes();
    dishes = dishes.filter(d => d.id !== dishId);
    wx.setStorageSync("lele_dishes_v1077", dishes);

    if (this.isCloudEnabled && this.db) {
      try {
        await this.db.collection("dishes").doc(dishId).remove();
      } catch (err) {
        console.warn("云端删除菜品错误:", err);
      }
    }
    return true;
  }

  // 重置回默认菜谱
  resetDefaultDishes() {
    wx.setStorageSync("lele_dishes_v1077", PRESET_DISHES);
    return PRESET_DISHES;
  }

  // 创建订单
  async createOrder(orderData) {
    const newOrder = {
      id: "ord_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      ...orderData,
      status: "pending",
      statusText: "待接单",
      createTime: Date.now(),
      createTimeStr: this.formatTime(new Date()),
      timeline: [
        {
          status: "pending",
          title: "家人已下单",
          time: this.formatTime(new Date())
        }
      ]
    };

    // 存储本地
    const orders = wx.getStorageSync("family_orders") || [];
    orders.unshift(newOrder);
    wx.setStorageSync("family_orders", orders);

    // 云数据库写入
    if (this.isCloudEnabled && this.db) {
      try {
        await this.db.collection("orders").add({
          data: { ...newOrder, _id: newOrder.id }
        });
      } catch (err) {
        console.warn("云端创建订单异常:", err);
      }
    }

    // 触发本地事件通知（模拟大厨端收到订单）
    if (typeof getApp === "function") {
      const app = getApp();
      if (app && app.triggerNewOrderAlert) {
        app.triggerNewOrderAlert(newOrder);
      }
    }

    return newOrder;
  }

  // 获取订单列表
  async getOrders(filterStatus = null) {
    let orders = [];
    if (this.isCloudEnabled && this.db) {
      try {
        const query = filterStatus ? { status: filterStatus } : {};
        const res = await this.db.collection("orders").where(query).orderBy("createTime", "desc").get();
        if (res.data) {
          orders = res.data;
        }
      } catch (err) {
        console.warn("云端读取订单失败，降级本地存储:", err);
      }
    }

    if (orders.length === 0) {
      orders = wx.getStorageSync("family_orders") || [];
      if (filterStatus) {
        orders = orders.filter(o => o.status === filterStatus);
      }
    }
    return orders.map(o => this.sanitizeDish(o));
  }

  // 更新订单状态
  async updateOrderStatus(orderId, nextStatus) {
    const orders = wx.getStorageSync("family_orders") || [];
    const target = orders.find(o => o.id === orderId);
    if (!target) return null;

    target.status = nextStatus;
    const meta = ORDER_STATUS[nextStatus.toUpperCase()];
    if (meta) {
      target.statusText = meta.label;
    }
    if (!target.timeline) target.timeline = [];
    target.timeline.push({
      status: nextStatus,
      title: meta ? meta.label : nextStatus,
      time: this.formatTime(new Date())
    });

    wx.setStorageSync("family_orders", orders);

    if (this.isCloudEnabled && this.db) {
      try {
        await this.db.collection("orders").doc(orderId).update({
          data: {
            status: nextStatus,
            statusText: target.statusText,
            timeline: target.timeline,
            updateTime: Date.now()
          }
        });
      } catch (err) {
        console.warn("云端更新订单状态失败:", err);
      }
    }

    return target;
  }

  // 监听大厨端新订单
  watchChefOrders(onChangeCallback) {
    if (this.isCloudEnabled && this.db) {
      try {
        this.watchListener = this.db.collection("orders")
          .where({ status: "pending" })
          .watch({
            onChange: (snapshot) => {
              if (snapshot.docChanges && snapshot.docChanges.length > 0) {
                const newDocs = snapshot.docChanges
                  .filter(c => c.dataType === "init" || c.dataType === "add")
                  .map(c => c.doc);
                if (newDocs.length > 0) {
                  onChangeCallback(newDocs);
                }
              }
            },
            onError: (err) => {
              console.warn("云端订单监听发生错误:", err);
            }
          });
        return this.watchListener;
      } catch (err) {
        console.warn("开启云端监听失败:", err);
      }
    }
    return null;
  }

  formatTime(date) {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}-${day} ${h}:${m}:${s}`;
  }
}

module.exports = {
  cloudHelper: new CloudHelper(),
  ORDER_STATUS
};
