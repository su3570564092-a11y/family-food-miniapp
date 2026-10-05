const { cloudHelper } = require("../../utils/cloudHelper");

Page({
  data: {
    orders: [],
    watcher: null
  },

  onLoad() {
    this.loadOrders();
    this.startWatch();
  },

  onShow() {
    this.loadOrders();
    if (!this.data.watcher) {
      this.startWatch();
    }
  },

  onHide() {
    this.stopWatch();
  },

  onUnload() {
    this.stopWatch();
  },

  startWatch() {
    const watcher = cloudHelper.watchAllOrders((newList) => {
      if (newList) {
        this.setData({ orders: newList });
      }
    });
    this.setData({ watcher });
  },

  stopWatch() {
    if (this.data.watcher) {
      try {
        this.data.watcher.close();
      } catch (e) {}
      this.setData({ watcher: null });
    }
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
