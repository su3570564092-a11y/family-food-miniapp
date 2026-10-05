const { cloudHelper } = require("./utils/cloudHelper");
const { deviceManager } = require("./utils/deviceManager");

App({
  globalData: {
    deviceId: null,
    profile: null,
    isChef: false,
    orderListeners: []
  },

  onLaunch() {
    // 强制清除旧版本残留脏缓存，并清空掌勺权限（恢复默认臭乐乐点餐界面，暗号设为0906）
    try {
      wx.removeStorageSync("family_dishes");
      wx.removeStorageSync("dishes");
      wx.removeStorageSync("chef_secret_pass");
      deviceManager.lockChefMode();
      const p = wx.getStorageSync("lele_device_profile");
      if (p && (p.nickname.indexOf("凯琪") >= 0 || (p.deviceAlias && p.deviceAlias.indexOf("凯琪") >= 0))) {
        p.nickname = "臭乐乐";
        p.deviceAlias = "臭乐乐的手机";
        wx.setStorageSync("lele_device_profile", p);
      }
    } catch (e) {}

    // 1. 初始化云开发与本地存储
    cloudHelper.init();

    // 2. 初始化本机独立设备身份
    const deviceId = deviceManager.getDeviceId();
    const profile = deviceManager.getDeviceProfile();
    this.globalData.deviceId = deviceId;
    this.globalData.profile = profile;

    console.log(`[重生之我在地球给臭乐乐当厨师] 本设备已就绪: ${profile.nickname} (${profile.deviceModel}) ID: ${deviceId}`);
  },

  // 播放新订单温馨提示音与震动
  playOrderNotificationSound() {
    try {
      // 触感震动
      wx.vibrateLong({
        type: "heavy"
      });

      // 提示音效（使用内置系统提示音或合成音频）
      const audioCtx = wx.createInnerAudioContext();
      // 使用微信开放的声音或在线轻柔铃声，也可以使用系统beep
      audioCtx.src = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
      audioCtx.play();
      audioCtx.onError((res) => {
        console.log("音频播放降级为振动:", res);
      });
    } catch (e) {
      console.warn("提示音播放异常:", e);
    }
  },

  // 注册全局订单监听回调
  registerOrderListener(callback) {
    if (typeof callback === "function") {
      this.globalData.orderListeners.push(callback);
    }
  },

  removeOrderListener(callback) {
    this.globalData.orderListeners = this.globalData.orderListeners.filter(cb => cb !== callback);
  },

  // 触发新订单广播
  triggerNewOrderAlert(newOrder) {
    this.playOrderNotificationSound();
    this.globalData.orderListeners.forEach(cb => {
      try {
        cb(newOrder);
      } catch (err) {
        console.error("订单监听回调错误:", err);
      }
    });
  }
});
