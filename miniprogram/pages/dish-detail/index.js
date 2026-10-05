const { cloudHelper } = require("../../utils/cloudHelper");
const { deviceManager } = require("../../utils/deviceManager");

Page({
  data: {
    dishId: "",
    dish: null,
    activeTab: "materials", // 'materials' | 'steps'
    checkedIngredients: {},
    activeTimerStep: null,
    timerCountDownSecs: 0,
    timerCountDownStr: "",
    timerIntervalId: null,
    dishCountInCart: 0,
    currentProfile: {}
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ dishId: options.id });
      this.loadDishDetail(options.id);
    }
    const profile = deviceManager.getDeviceProfile();
    this.setData({ currentProfile: profile });
  },

  onShow() {
    this.updateCartCount();
  },

  onUnload() {
    this.clearTimer();
  },

  async loadDishDetail(id) {
    wx.showLoading({ title: "加载美味秘籍..." });
    try {
      const dish = await cloudHelper.getDishById(id);
      if (dish) {
        this.setData({ dish });
        wx.setNavigationBarTitle({ title: dish.name });
      } else {
        wx.showToast({ title: "菜品不存在", icon: "error" });
      }
    } catch (e) {
      console.error("加载菜品详情失败:", e);
    } finally {
      wx.hideLoading();
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  // 备菜打勾
  toggleIngredientCheck(e) {
    const name = e.currentTarget.dataset.name;
    const current = !!this.data.checkedIngredients[name];
    this.setData({
      [`checkedIngredients.${name}`]: !current
    });
    wx.vibrateShort({ type: "light" });
  },

  // 步骤火候倒计时定时器
  toggleStepTimer(e) {
    const step = e.currentTarget.dataset.step;
    const totalSecs = e.currentTarget.dataset.seconds || 60;

    if (this.data.activeTimerStep === step) {
      // 停止计时
      this.clearTimer();
      wx.showToast({ title: "计时已暂停", icon: "none" });
      return;
    }

    this.clearTimer();
    this.setData({
      activeTimerStep: step,
      timerCountDownSecs: totalSecs,
      timerCountDownStr: this.formatSeconds(totalSecs)
    });

    wx.showToast({ title: `第${step}步开始计时`, icon: "none" });

    const intervalId = setInterval(() => {
      let secs = this.data.timerCountDownSecs - 1;
      if (secs <= 0) {
        this.clearTimer();
        // 倒计时结束，长震动提醒大厨关火/翻炒
        wx.vibrateLong({ type: "heavy" });
        wx.showModal({
          title: "⏰ 火候时间到！",
          content: `第${step}步所需时间已到，请注意开锅或进行下一步骤！`,
          showCancel: false,
          confirmText: "知道了",
          confirmColor: "#FA6432"
        });
      } else {
        this.setData({
          timerCountDownSecs: secs,
          timerCountDownStr: this.formatSeconds(secs)
        });
      }
    }, 1000);

    this.setData({ timerIntervalId: intervalId });
  },

  clearTimer() {
    if (this.data.timerIntervalId) {
      clearInterval(this.data.timerIntervalId);
      this.setData({
        timerIntervalId: null,
        activeTimerStep: null
      });
    }
  },

  formatSeconds(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}分${s < 10 ? '0' : ''}${s}秒`;
  },

  // 更新当前菜品在购物车的数量
  updateCartCount() {
    if (!this.data.dish) return;
    const cart = deviceManager.getDeviceCart();
    const item = cart.find(c => c.dish.id === this.data.dish.id);
    this.setData({
      dishCountInCart: item ? item.count : 0
    });
  },

  // 加入点餐篮
  addToCart() {
    if (!this.data.dish) return;
    const cart = deviceManager.getDeviceCart();
    const idx = cart.findIndex(c => c.dish.id === this.data.dish.id);

    if (idx >= 0) {
      cart[idx].count += 1;
    } else {
      cart.push({
        dish: this.data.dish,
        count: 1
      });
    }

    deviceManager.saveDeviceCart(cart);
    this.updateCartCount();

    wx.vibrateShort({ type: "medium" });
    wx.showToast({
      title: `已加入点餐篮 (x${this.data.dishCountInCart})`,
      icon: "success",
      duration: 1000
    });
  },

  onShareAppMessage() {
    const dish = this.data.dish;
    return {
      title: `今天想吃【${dish.name}】吗？快来看看配料！`,
      path: `/pages/dish-detail/index?id=${dish.id}`
    };
  }
});
