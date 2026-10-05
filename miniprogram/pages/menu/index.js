const { cloudHelper } = require("../../utils/cloudHelper");
const { deviceManager, USER_ROLES } = require("../../utils/deviceManager");
const { CATEGORIES } = require("../../utils/defaultData");

Page({
  data: {
    categories: CATEGORIES,
    currentCategory: "all",
    dishes: [],
    allFilteredDishes: [],
    filteredDishes: [],
    page: 1,
    pageSize: 30,
    hasMore: true,
    searchKeyword: "",
    cartCounts: {},
    totalCount: 0,
    currentProfile: {},
    showDeviceModal: false,
    familyRoles: USER_ROLES,
    isChefAuthenticated: false,
    editProfile: {
      roleId: "",
      nickname: "",
      avatar: "",
      deviceAlias: ""
    }
  },

  onLoad() {
    // 强制清理历史脏缓存
    try {
      wx.removeStorageSync("family_dishes");
      wx.removeStorageSync("dishes");
    } catch (e) {}

    this.initDeviceProfile();
    this.loadDishes();
  },

  onShow() {
    this.initDeviceProfile();
    this.syncCartFromStorage();
    this.loadDishes();
  },

  onReachBottom() {
    this.loadMoreDishes();
  },

  onPullDownRefresh() {
    this.loadDishes().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  initDeviceProfile() {
    const profile = deviceManager.getDeviceProfile();
    const isChef = deviceManager.isChefAuthenticated();
    this.setData({
      currentProfile: profile,
      isChefAuthenticated: isChef,
      editProfile: {
        roleId: profile.roleId,
        nickname: profile.nickname,
        avatar: profile.avatar,
        deviceAlias: profile.deviceAlias || profile.deviceModel
      }
    });
  },

  async loadDishes() {
    wx.showNavigationBarLoading();
    try {
      const dishes = await cloudHelper.getDishes();
      this.setData({ dishes }, () => {
        this.filterDishes();
        this.syncCartFromStorage();
      });
    } catch (err) {
      console.error("加载菜谱失败:", err);
    } finally {
      wx.hideNavigationBarLoading();
    }
  },

  filterDishes() {
    const { dishes, currentCategory, searchKeyword } = this.data;
    const keyword = (searchKeyword || "").trim().toLowerCase();

    let list = dishes.filter(d => d.available !== false);

    if (currentCategory !== "all") {
      list = list.filter(d => d.category === currentCategory);
    }

    if (keyword) {
      list = list.filter(d => {
        const matchName = d.name.toLowerCase().includes(keyword);
        const matchIng = d.ingredients && d.ingredients.some(i => i.name.toLowerCase().includes(keyword));
        const matchTag = d.tags && d.tags.some(t => t.toLowerCase().includes(keyword));
        return matchName || matchIng || matchTag;
      });
    }

    const firstBatch = list.slice(0, this.data.pageSize);
    this.setData({
      allFilteredDishes: list,
      filteredDishes: firstBatch,
      page: 1,
      hasMore: list.length > this.data.pageSize
    });
  },

  loadMoreDishes() {
    const { allFilteredDishes, filteredDishes, page, pageSize } = this.data;
    if (filteredDishes.length >= allFilteredDishes.length) return;
    const nextPage = page + 1;
    const nextList = allFilteredDishes.slice(0, nextPage * pageSize);
    this.setData({
      page: nextPage,
      filteredDishes: nextList,
      hasMore: nextList.length < allFilteredDishes.length
    });
  },

  selectCategory(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ currentCategory: key }, () => {
      this.filterDishes();
    });
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value }, () => {
      this.filterDishes();
    });
  },

  clearSearch() {
    this.setData({ searchKeyword: "" }, () => {
      this.filterDishes();
    });
  },

  syncCartFromStorage() {
    const cart = deviceManager.getDeviceCart();
    const counts = {};
    let total = 0;
    cart.forEach(item => {
      counts[item.dish.id] = item.count;
      total += item.count;
    });
    this.setData({
      cartCounts: counts,
      totalCount: total
    });
  },

  increaseCart(e) {
    const dish = e.currentTarget.dataset.dish;
    const cart = deviceManager.getDeviceCart();
    const idx = cart.findIndex(c => c.dish.id === dish.id);

    if (idx >= 0) {
      cart[idx].count += 1;
    } else {
      cart.push({
        dish: dish,
        count: 1
      });
    }

    deviceManager.saveDeviceCart(cart);
    this.syncCartFromStorage();

    wx.vibrateShort({ type: "light" });
  },

  decreaseCart(e) {
    const dish = e.currentTarget.dataset.dish;
    const cart = deviceManager.getDeviceCart();
    const idx = cart.findIndex(c => c.dish.id === dish.id);

    if (idx >= 0) {
      cart[idx].count -= 1;
      if (cart[idx].count <= 0) {
        cart.splice(idx, 1);
      }
      deviceManager.saveDeviceCart(cart);
      this.syncCartFromStorage();
      wx.vibrateShort({ type: "light" });
    }
  },

  goToDishDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/dish-detail/index?id=${id}`
    });
  },

  goToCart() {
    wx.navigateTo({
      url: "/pages/cart/index"
    });
  },

  openDeviceModal() {
    const p = this.data.currentProfile;
    this.setData({
      showDeviceModal: true,
      editProfile: {
        roleId: p.roleId,
        nickname: p.nickname,
        avatar: p.avatar,
        deviceAlias: p.deviceAlias || p.deviceModel
      }
    });
  },

  closeDeviceModal() {
    this.setData({ showDeviceModal: false });
  },

  preventBubble() {},

  selectRolePreset(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({
      "editProfile.roleId": role.id,
      "editProfile.nickname": role.name,
      "editProfile.avatar": role.avatar
    });
  },

  onNicknameInput(e) {
    this.setData({ "editProfile.nickname": e.detail.value });
  },

  onDeviceAliasInput(e) {
    this.setData({ "editProfile.deviceAlias": e.detail.value });
  },

  saveDeviceProfile() {
    const { editProfile } = this.data;
    if (!editProfile.nickname.trim()) {
      wx.showToast({ title: "请输入专属称呼", icon: "none" });
      return;
    }
    const updated = deviceManager.saveDeviceProfile({
      roleId: editProfile.roleId,
      nickname: editProfile.nickname.trim(),
      avatar: editProfile.avatar,
      deviceAlias: editProfile.deviceAlias.trim()
    });

    this.setData({
      currentProfile: updated,
      showDeviceModal: false
    });

    wx.showToast({
      title: "💖 身份已更新",
      icon: "success"
    });
  },

  // 跳转进入掌勺工作台
  goToChefOrders() {
    wx.navigateTo({
      url: "/pages/chef-orders/index"
    });
  },

  // 掌勺身份验证暗门
  triggerChefAuthModal() {
    const isAuth = this.data.isChefAuthenticated;
    if (isAuth) {
      wx.showModal({
        title: "掌勺模式已解锁",
        content: "当前设备已被设为掌勺做饭模式。是否重新恢复为臭乐乐点餐模式？",
        confirmText: "锁定恢复",
        confirmColor: "#FF4D7E",
        cancelText: "保持解锁",
        success: (res) => {
          if (res.confirm) {
            deviceManager.lockChefMode();
            this.initDeviceProfile();
            this.setData({ showDeviceModal: false });
            wx.showToast({ title: "已重新锁定", icon: "none" });
          }
        }
      });
    } else {
      wx.showModal({
        title: "🔒 掌勺身份验证",
        content: "",
        editable: true,
        placeholderText: "输入暗号...",
        confirmText: "解锁",
        confirmColor: "#FF4D7E",
        success: (res) => {
          if (res.confirm) {
            const inputVal = (res.content || "").trim();
            const success = deviceManager.verifyChefPassword(inputVal);
            if (success) {
              this.initDeviceProfile();
              this.setData({ showDeviceModal: false });
              wx.showToast({ title: "🎉 掌勺身份已解锁！", icon: "success" });
            } else {
              wx.showToast({ title: "暗号错误，请重新输入", icon: "error" });
            }
          }
        }
      });
    }
  }
});
