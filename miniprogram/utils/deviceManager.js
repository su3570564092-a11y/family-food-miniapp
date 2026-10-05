const CHEF_PASSWORD_KEY = "chef_secret_pass";
const CHEF_AUTH_KEY = "is_chef_device_authenticated";
const DEFAULT_PASSWORD = "0906"; 

const USER_ROLES = [
  { id: "lele", name: "臭乐乐", avatar: "🐱", desc: "点餐" },
  { id: "chef", name: "掌勺 (我)", avatar: "👨‍🍳", desc: "做饭接单 (需暗号验证)" }
];

class DeviceManager {
  constructor() {
    this.deviceIdKey = "lele_device_id";
    this.deviceProfileKey = "lele_device_profile";
  }

  getDeviceId() {
    let devId = wx.getStorageSync(this.deviceIdKey);
    if (!devId) {
      const randomPart = Math.random().toString(36).substring(2, 10);
      const timePart = Date.now().toString(36);
      devId = `dev_lele_${timePart}_${randomPart}`;
      wx.setStorageSync(this.deviceIdKey, devId);
    }
    return devId;
  }

  getSystemInfoSummary() {
    try {
      const info = wx.getSystemInfoSync();
      return `${info.brand || ""} ${info.model || "手机"}`.trim();
    } catch (e) {
      return "手机";
    }
  }

  getDeviceProfile() {
    const devId = this.getDeviceId();
    let profile = wx.getStorageSync(this.deviceProfileKey);
    if (!profile) {
      const defaultRole = USER_ROLES[0]; // 默认臭乐乐
      const model = this.getSystemInfoSummary();
      profile = {
        deviceId: devId,
        roleId: defaultRole.id,
        nickname: defaultRole.name,
        avatar: defaultRole.avatar,
        deviceModel: model,
        deviceAlias: "臭乐乐的手机",
        isChef: false,
        tastePreference: "少油少盐"
      };
      wx.setStorageSync(this.deviceProfileKey, profile);
    }
    return profile;
  }

  saveDeviceProfile(updated) {
    const current = this.getDeviceProfile();
    const merged = { ...current, ...updated };
    wx.setStorageSync(this.deviceProfileKey, merged);
    return merged;
  }

  getDeviceCart() {
    const devId = this.getDeviceId();
    const cartKey = `lele_cart_${devId}`;
    return wx.getStorageSync(cartKey) || [];
  }

  saveDeviceCart(items) {
    const devId = this.getDeviceId();
    const cartKey = `lele_cart_${devId}`;
    wx.setStorageSync(cartKey, items);
  }

  clearDeviceCart() {
    const devId = this.getDeviceId();
    const cartKey = `lele_cart_${devId}`;
    wx.removeStorageSync(cartKey);
  }

  // 掌勺端权限验证
  isChefAuthenticated() {
    return !!wx.getStorageSync(CHEF_AUTH_KEY);
  }

  verifyChefPassword(pwd) {
    const setPass = wx.getStorageSync(CHEF_PASSWORD_KEY) || DEFAULT_PASSWORD;
    if (pwd === setPass) {
      wx.setStorageSync(CHEF_AUTH_KEY, true);
      this.saveDeviceProfile({
        roleId: "chef",
        nickname: "掌勺",
        avatar: "👨‍🍳",
        deviceAlias: "做饭设备",
        isChef: true
      });
      return true;
    }
    return false;
  }

  lockChefMode() {
    wx.removeStorageSync(CHEF_AUTH_KEY);
    this.saveDeviceProfile({
      roleId: "lele",
      nickname: "臭乐乐",
      avatar: "🐱",
      deviceAlias: "臭乐乐的手机",
      isChef: false
    });
  }

  getRoles() {
    return USER_ROLES;
  }
}

module.exports = {
  deviceManager: new DeviceManager(),
  USER_ROLES,
  LELE_ROLES: USER_ROLES,
  FAMILY_ROLES: USER_ROLES,
  GIRLFRIEND_ROLES: USER_ROLES
};
