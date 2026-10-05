const { cloudHelper } = require("../../utils/cloudHelper");

Page({
  data: {
    orders: []
  },

  onLoad() {
    this.loadOrders();
  },

  onShow() {
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadOrders() {
    wx.showNavigationBarLoading();
    try {
      const list = await cloudHelper.getOrders();
      this.setData({ orders: list });
    } catch (e) {
      console.error("加载进度失败:", e);
    } finally {
      wx.hideNavigationBarLoading();
    }
  },

  goToMenu() {
    wx.switchTab({
      url: "/pages/menu/index"
    });
  }
});
