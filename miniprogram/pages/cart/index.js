const { cloudHelper } = require("../../utils/cloudHelper");
const { deviceManager } = require("../../utils/deviceManager");

Page({
  data: {
    currentProfile: {},
    cartItems: [],
    totalCount: 0,
    mealTypes: [
      { key: "breakfast", label: "早餐", icon: "🥣" },
      { key: "lunch", label: "午餐", icon: "🍚" },
      { key: "dinner", label: "晚餐", icon: "🍲" },
      { key: "night", label: "夜宵", icon: "🍢" }
    ],
    selectedMealType: "lunch",
    expectedTime: "",
    quickTags: [
      "少油少盐",
      "不放香菜",
      "不放葱花",
      "多放葱花",
      "微辣",
      "不辣",
      "多留点汤汁",
      "肉煮软烂一些"
    ],
    selectedQuickTags: {},
    customRemark: "",
    isSubmitting: false
  },

  onLoad() {
    this.refreshDeviceProfile();
    this.guessCurrentMealType();
  },

  onShow() {
    this.refreshDeviceProfile();
    this.loadCart();
  },

  refreshDeviceProfile() {
    const profile = deviceManager.getDeviceProfile();
    this.setData({ currentProfile: profile });
  },

  guessCurrentMealType() {
    const hour = new Date().getHours();
    let type = "lunch";
    if (hour >= 5 && hour < 10) {
      type = "breakfast";
    } else if (hour >= 10 && hour < 15) {
      type = "lunch";
    } else if (hour >= 15 && hour < 21) {
      type = "dinner";
    } else {
      type = "night";
    }
    this.setData({ selectedMealType: type });
  },

  loadCart() {
    const items = deviceManager.getDeviceCart();
    let count = 0;
    items.forEach(i => count += i.count);
    this.setData({
      cartItems: items,
      totalCount: count
    });
  },

  increaseItem(e) {
    const index = e.currentTarget.dataset.index;
    const items = this.data.cartItems;
    items[index].count += 1;
    deviceManager.saveDeviceCart(items);
    this.loadCart();
  },

  decreaseItem(e) {
    const index = e.currentTarget.dataset.index;
    const items = this.data.cartItems;
    items[index].count -= 1;
    if (items[index].count <= 0) {
      items.splice(index, 1);
    }
    deviceManager.saveDeviceCart(items);
    this.loadCart();
  },

  confirmClearCart() {
    wx.showModal({
      title: "清空点餐单",
      content: "确定要清空已选的菜品吗？",
      confirmColor: "#FF4D7E",
      success: (res) => {
        if (res.confirm) {
          deviceManager.clearDeviceCart();
          this.loadCart();
        }
      }
    });
  },

  selectMealType(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ selectedMealType: key });
  },

  onTimeChange(e) {
    this.setData({ expectedTime: e.detail.value });
  },

  toggleQuickTag(e) {
    const tag = e.currentTarget.dataset.tag;
    const current = !!this.data.selectedQuickTags[tag];
    this.setData({
      [`selectedQuickTags.${tag}`]: !current
    });
  },

  onRemarkInput(e) {
    this.setData({ customRemark: e.detail.value });
  },

  goToMenu() {
    wx.switchTab({
      url: "/pages/menu/index"
    });
  },

  goToChangeProfile() {
    wx.switchTab({
      url: "/pages/menu/index"
    });
  },

  async submitOrder() {
    if (this.data.cartItems.length === 0) {
      wx.showToast({ title: "点餐单是空的", icon: "none" });
      return;
    }

    if (this.data.isSubmitting) return;
    this.setData({ isSubmitting: true });

    wx.showLoading({ title: "正在提交订单..." });

    try {
      const {
        currentProfile,
        cartItems,
        selectedMealType,
        expectedTime,
        selectedQuickTags,
        customRemark
      } = this.data;

      const activeTags = Object.keys(selectedQuickTags).filter(k => selectedQuickTags[k]);
      const mealTypeObj = this.data.mealTypes.find(m => m.key === selectedMealType);

      const orderData = {
        deviceInfo: {
          deviceId: currentProfile.deviceId,
          nickname: currentProfile.nickname,
          avatar: currentProfile.avatar,
          deviceModel: currentProfile.deviceModel,
          deviceAlias: currentProfile.deviceAlias || currentProfile.deviceModel
        },
        mealType: selectedMealType,
        mealTypeLabel: mealTypeObj ? mealTypeObj.label : "正餐",
        expectedTime: expectedTime || "尽快出锅 (现点现做)",
        dishes: cartItems.map(item => ({
          id: item.dish.id,
          name: item.dish.name,
          categoryName: item.dish.categoryName,
          icon: item.dish.icon,
          image: item.dish.image || "",
          count: item.count,
          cookingTime: item.dish.cookingTime,
          ingredients: item.dish.ingredients,
          seasonings: item.dish.seasonings,
          steps: item.dish.steps,
          chefTips: item.dish.chefTips
        })),
        tasteTags: activeTags,
        customRemark: customRemark.trim()
      };

      await cloudHelper.createOrder(orderData);

      deviceManager.clearDeviceCart();
      this.loadCart();

      wx.hideLoading();

      wx.showModal({
        title: "订单已提交",
        content: `已成功提交 ${orderData.dishes.length} 道菜品，大厨正在准备做餐！`,
        confirmText: "查看进度",
        confirmColor: "#FF4D7E",
        cancelText: "返回菜单",
        success: (result) => {
          if (result.confirm) {
            wx.switchTab({
              url: "/pages/order-history/index"
            });
          } else {
            wx.switchTab({
              url: "/pages/menu/index"
            });
          }
        }
      });
    } catch (err) {
      console.error("提交订单异常:", err);
      wx.hideLoading();
      wx.showToast({ title: "提交失败，请重试", icon: "error" });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
