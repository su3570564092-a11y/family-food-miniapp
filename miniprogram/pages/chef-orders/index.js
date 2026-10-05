const { cloudHelper, ORDER_STATUS } = require("../../utils/cloudHelper");

Page({
  data: {
    orders: [],
    filteredOrders: [],
    currentFilter: "all",
    statusFilters: [
      { key: "all", label: "全部" },
      { key: "pending", label: "臭乐乐已点" },
      { key: "preparing", label: "备菜中" },
      { key: "cooking", label: "烹饪中" },
      { key: "served", label: "已端上" }
    ],
    statusCounts: {
      all: 0,
      pending: 0,
      preparing: 0,
      cooking: 0,
      served: 0
    },
    activeRecipeDish: null,
    showGroceryModal: false,
    activeGroceryOrder: null,
    groceryIngredients: [],
    grocerySeasonings: [],
    showPlanModal: false,
    activePlanOrder: null,
    cookingPlanSteps: [],
    watcher: null
  },

  onLoad() {
    this.loadOrders();
    this.setupRealtimeAlerts();
  },

  onShow() {
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onUnload() {
    if (typeof getApp === "function") {
      const app = getApp();
      if (app && app.removeOrderListener) {
        app.removeOrderListener(this.onNewOrderAlert);
      }
    }
  },

  setupRealtimeAlerts() {
    const app = getApp();
    if (app && app.registerOrderListener) {
      this.onNewOrderAlert = (newOrder) => {
        wx.showModal({
          title: "🔔 臭乐乐发来新点单啦！",
          content: `【${newOrder.deviceInfo.nickname || '臭乐乐'}】提交了点餐，可以准备做饭啦！`,
          confirmText: "立即查看",
          confirmColor: "#FF4D7E",
          showCancel: false,
          success: () => {
            this.loadOrders();
          }
        });
      };
      app.registerOrderListener(this.onNewOrderAlert);
    }

    cloudHelper.watchChefOrders(() => {
      this.loadOrders();
    });
  },

  async loadOrders() {
    wx.showNavigationBarLoading();
    try {
      const orders = await cloudHelper.getOrders();
      this.setData({ orders }, () => {
        this.calculateCounts();
        this.filterOrders();
      });
    } catch (err) {
      console.error("加载订单失败:", err);
    } finally {
      wx.hideNavigationBarLoading();
    }
  },

  calculateCounts() {
    const orders = this.data.orders;
    const counts = { all: orders.length, pending: 0, preparing: 0, cooking: 0, served: 0 };
    orders.forEach(o => {
      if (counts[o.status] !== undefined) {
        counts[o.status] += 1;
      }
    });
    this.setData({ statusCounts: counts });
  },

  filterOrders() {
    const { orders, currentFilter } = this.data;
    if (currentFilter === "all") {
      this.setData({ filteredOrders: orders });
    } else {
      this.setData({
        filteredOrders: orders.filter(o => o.status === currentFilter)
      });
    }
  },

  switchFilter(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ currentFilter: key }, () => {
      this.filterOrders();
    });
  },

  async openRecipeDrawer(e) {
    const dish = e.currentTarget.dataset.dish;
    if (!dish) return;

    if (!dish.steps || dish.steps.length === 0) {
      wx.showLoading({ title: "加载秘籍..." });
      const fullDish = await cloudHelper.getDishById(dish.id);
      wx.hideLoading();
      this.setData({ activeRecipeDish: fullDish || dish });
    } else {
      this.setData({ activeRecipeDish: dish });
    }

    wx.vibrateShort({ type: "light" });
  },

  closeRecipeDrawer() {
    this.setData({ activeRecipeDish: null });
  },

  preventBubble() {},

  // ================= 🛒 买菜清单（总量合并汇总） =================
  openGroceryModal(e) {
    const order = e.currentTarget.dataset.order;
    if (!order || !order.dishes) return;

    const ingredientMap = {};
    const seasoningMap = {};

    order.dishes.forEach(d => {
      const count = d.count || 1;
      (d.ingredients || []).forEach(ing => {
        const name = (ing.name || "").trim();
        if (!name) return;
        if (!ingredientMap[name]) {
          ingredientMap[name] = {
            name: name,
            sources: [],
            amounts: [],
            checked: false
          };
        }
        ingredientMap[name].sources.push(`${d.name}×${count}`);
        if (ing.amount) {
          ingredientMap[name].amounts.push(`${ing.amount}${count > 1 ? `(×${count})` : ''}`);
        }
      });

      (d.seasonings || []).forEach(sea => {
        const name = (sea.name || "").trim();
        if (!name) return;
        if (!seasoningMap[name]) {
          seasoningMap[name] = {
            name: name,
            sources: [],
            amounts: []
          };
        }
        seasoningMap[name].sources.push(d.name);
        if (sea.amount) {
          seasoningMap[name].amounts.push(sea.amount);
        }
      });
    });

    const ingredientList = Object.values(ingredientMap).map(item => ({
      ...item,
      amountStr: item.amounts.join(" + ") || "适量",
      sourceStr: item.sources.join("、")
    }));

    const seasoningList = Object.values(seasoningMap).map(item => ({
      ...item,
      amountStr: item.amounts.join(" + ") || "适量"
    }));

    this.setData({
      activeGroceryOrder: order,
      groceryIngredients: ingredientList,
      grocerySeasonings: seasoningList,
      showGroceryModal: true
    });
    wx.vibrateShort({ type: "light" });
  },

  toggleGroceryItem(e) {
    const index = e.currentTarget.dataset.index;
    const list = this.data.groceryIngredients;
    if (list[index]) {
      list[index].checked = !list[index].checked;
      this.setData({ groceryIngredients: list });
      wx.vibrateShort({ type: "light" });
    }
  },

  copyGroceryList() {
    const { activeGroceryOrder, groceryIngredients, grocerySeasonings } = this.data;
    if (!groceryIngredients || groceryIngredients.length === 0) return;

    let text = `🛒 【臭乐乐点餐·食材采购清单】\n`;
    text += `📅 订单时间：${activeGroceryOrder.createTimeStr || ''}\n`;
    text += `🍲 点单菜品：${(activeGroceryOrder.dishes || []).map(d => d.name + '×' + d.count).join('、')}\n\n`;
    text += `【需要买的食材汇总】\n`;
    groceryIngredients.forEach((item, idx) => {
      text += `${idx + 1}. ${item.name}：${item.amountStr} （用于：${item.sourceStr}）\n`;
    });
    if (grocerySeasonings.length > 0) {
      text += `\n【厨房调料检查】\n`;
      text += grocerySeasonings.map(s => s.name).join('、') + `\n`;
    }
    text += `\n买齐食材，给臭乐乐做大餐啦~💖`;

    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: "买菜清单已复制", icon: "success" });
      }
    });
  },

  closeGroceryModal() {
    this.setData({ showGroceryModal: false, activeGroceryOrder: null });
  },

  // ================= 👨‍🍳 最佳做菜顺序指南 =================
  openCookingPlan(e) {
    const order = e.currentTarget.dataset.order;
    if (!order || !order.dishes) return;

    const phase1_slow = [];
    const phase3_medium = [];
    const phase4_quick = [];

    order.dishes.forEach(d => {
      const name = d.name || "";
      const cat = d.category || "";
      const timeNum = parseInt(d.cookingTime) || 15;
      
      if (cat === "soup" || name.includes("汤") || name.includes("煲") || name.includes("炖") || timeNum >= 25) {
        phase1_slow.push(d);
      } else if (name.includes("蒸") || name.includes("焖") || name.includes("烧") || timeNum >= 12) {
        phase3_medium.push(d);
      } else {
        phase4_quick.push(d);
      }
    });

    const planSteps = [];
    let stepNum = 1;

    if (phase1_slow.length > 0) {
      planSteps.push({
        num: stepNum++,
        title: "第 1 步：优先开火·长时间慢煲",
        badge: "慢炖先行",
        badgeColor: "#FF5722",
        timeEstimate: "建议第 0 分钟先煲上",
        desc: `【${phase1_slow.map(d => d.name).join('、')}】所需时间较长，第一时间洗切下锅煲上，盖上锅盖慢炖，不占炒锅也不耗精力。`,
        dishes: phase1_slow
      });
    }

    planSteps.push({
      num: stepNum++,
      title: "第 2 步：集中备料·肉类抓匀腌制",
      badge: "入味关键",
      badgeColor: "#FF9800",
      timeEstimate: "耗时约 10-15 分钟",
      desc: "所有肉类、海鲜切好，加入生抽、料酒、淀粉抓匀腌制10分钟使其嫩滑入味；蔬菜清洗沥干、葱姜蒜切配待用。",
      dishes: []
    });

    if (phase3_medium.length > 0) {
      planSteps.push({
        num: stepNum++,
        title: "第 3 步：中火慢烧 / 蒸锅上汽",
        badge: "中火慢烹",
        badgeColor: "#9C27B0",
        timeEstimate: "耗时约 12-18 分钟",
        desc: `【${phase3_medium.map(d => d.name).join('、')}】开始下锅慢煎、焖烧或上蒸锅大火蒸制，保持适当火候。`,
        dishes: phase3_medium
      });
    }

    if (phase4_quick.length > 0) {
      planSteps.push({
        num: stepNum++,
        title: "第 4 步：大火爆炒·快手菜最后下锅",
        badge: "锅气爆发",
        badgeColor: "#E91E63",
        timeEstimate: "建议开饭前最后 3-5 分钟",
        desc: `【${phase4_quick.map(d => d.name).join('、')}】快熟热炒一定要在开饭前最后几分钟大火爆炒，出锅立即装盘，保证热气腾腾、不放凉不蔫软！`,
        dishes: phase4_quick
      });
    }

    planSteps.push({
      num: stepNum++,
      title: "第 5 步：多菜同步·热腾腾端上餐桌",
      badge: "开饭啦",
      badgeColor: "#4CAF50",
      timeEstimate: "协同上桌",
      desc: "煲汤熄火盛碗，热菜端上餐桌，盛满热米饭，大功告成，呼叫臭乐乐开饭！",
      dishes: []
    });

    this.setData({
      activePlanOrder: order,
      cookingPlanSteps: planSteps,
      showPlanModal: true
    });
    wx.vibrateShort({ type: "light" });
  },

  closePlanModal() {
    this.setData({ showPlanModal: false, activePlanOrder: null });
  },

  async handleStatusAdvance(e) {
    const { id, next } = e.currentTarget.dataset;
    wx.showLoading({ title: "更新状态..." });

    try {
      await cloudHelper.updateOrderStatus(id, next);
      wx.hideLoading();

      if (next === "served") {
        wx.showModal({
          title: "🎉 菜品已全部做好！",
          content: "热腾腾的饭菜已上桌，快叫臭乐乐开饭啦！",
          showCancel: false,
          confirmText: "开饭啦",
          confirmColor: "#FF4D7E"
        });
      } else {
        wx.showToast({ title: "状态已更新", icon: "success" });
      }

      this.loadOrders();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: "更新失败", icon: "error" });
    }
  }
});
