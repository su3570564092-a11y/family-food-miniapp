const { cloudHelper } = require("../../utils/cloudHelper");
const { CATEGORIES } = require("../../utils/defaultData");

const CATEGORY_OPTIONS = [
  { key: "breakfast", name: "早餐" },
  { key: "lunch", name: "午餐" },
  { key: "dinner", name: "晚餐" },
  { key: "soup", name: "汤品" },
  { key: "snack", name: "夜宵" }
];

Page({
  data: {
    dishes: [],
    allFilteredDishes: [],
    filteredDishes: [],
    page: 1,
    pageSize: 40,
    hasMore: true,
    categories: CATEGORIES,
    currentCat: "all",
    categoryOptions: CATEGORY_OPTIONS,
    selectedCatIndex: 1,
    showEditModal: false,
    isEditing: false,
    formData: {
      id: "",
      name: "",
      icon: "🍲",
      category: "lunch",
      categoryName: "午餐",
      cookingTime: "15分钟",
      difficulty: "简单",
      description: "",
      ingredients: [],
      seasonings: [],
      steps: [],
      chefTips: "",
      available: true
    }
  },

  onLoad() {
    this.loadDishes();
  },

  onShow() {
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

  async loadDishes() {
    wx.showNavigationBarLoading();
    try {
      const dishes = await cloudHelper.getDishes();
      this.setData({ dishes }, () => {
        this.filterDishes();
      });
    } catch (e) {
      console.error("加载菜品失败:", e);
    } finally {
      wx.hideNavigationBarLoading();
    }
  },

  filterDishes() {
    const { dishes, currentCat } = this.data;
    let list = dishes;
    if (currentCat !== "all") {
      list = dishes.filter(d => d.category === currentCat);
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
    this.setData({ currentCat: key }, () => {
      this.filterDishes();
    });
  },

  // 启停用菜品
  async toggleDishAvailability(e) {
    const id = e.currentTarget.dataset.id;
    const isAvailable = e.detail.value;

    const dish = this.data.dishes.find(d => d.id === id);
    if (!dish) return;

    dish.available = isAvailable;
    await cloudHelper.saveDish(dish);
    this.loadDishes();

    wx.showToast({
      title: isAvailable ? "已设为可点" : "已设为暂缺",
      icon: "none"
    });
  },

  // 预览详情
  previewDishDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/dish-detail/index?id=${id}`
    });
  },

  // 打开新增弹窗
  openAddModal() {
    this.setData({
      isEditing: false,
      showEditModal: true,
      selectedCatIndex: 1,
      formData: {
        id: "",
        name: "",
        icon: "🍲",
        category: "lunch",
        categoryName: "午餐",
        cookingTime: "15分钟",
        difficulty: "简单",
        description: "",
        ingredients: [
          { name: "", amount: "", note: "" }
        ],
        seasonings: [
          { name: "", amount: "", note: "" }
        ],
        steps: [
          { step: 1, title: "", desc: "", tips: "", timerSeconds: 0 }
        ],
        chefTips: "",
        available: true
      }
    });
  },

  // 打开编辑弹窗
  openEditModal(e) {
    const dish = e.currentTarget.dataset.dish;
    const catIdx = CATEGORY_OPTIONS.findIndex(c => c.key === dish.category);

    this.setData({
      isEditing: true,
      showEditModal: true,
      selectedCatIndex: catIdx >= 0 ? catIdx : 1,
      formData: JSON.parse(JSON.stringify(dish))
    });
  },

  closeEditModal() {
    this.setData({ showEditModal: false });
  },

  preventBubble() {},

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`formData.${field}`]: e.detail.value
    });
  },

  onCatPickerChange(e) {
    const idx = Number(e.detail.value);
    const cat = CATEGORY_OPTIONS[idx];
    this.setData({
      selectedCatIndex: idx,
      "formData.category": cat.key,
      "formData.categoryName": cat.name
    });
  },

  // 动态修改食材行
  addIngredientRow() {
    const list = this.data.formData.ingredients || [];
    list.push({ name: "", amount: "", note: "" });
    this.setData({ "formData.ingredients": list });
  },

  removeIngredientRow(e) {
    const idx = e.currentTarget.dataset.index;
    const list = this.data.formData.ingredients;
    list.splice(idx, 1);
    this.setData({ "formData.ingredients": list });
  },

  onIngredientChange(e) {
    const { index, field } = e.currentTarget.dataset;
    this.setData({
      [`formData.ingredients[${index}].${field}`]: e.detail.value
    });
  },

  // 动态修改调料行
  addSeasoningRow() {
    const list = this.data.formData.seasonings || [];
    list.push({ name: "", amount: "", note: "" });
    this.setData({ "formData.seasonings": list });
  },

  removeSeasoningRow(e) {
    const idx = e.currentTarget.dataset.index;
    const list = this.data.formData.seasonings;
    list.splice(idx, 1);
    this.setData({ "formData.seasonings": list });
  },

  onSeasoningChange(e) {
    const { index, field } = e.currentTarget.dataset;
    this.setData({
      [`formData.seasonings[${index}].${field}`]: e.detail.value
    });
  },

  // 动态修改步骤行
  addStepRow() {
    const list = this.data.formData.steps || [];
    list.push({
      step: list.length + 1,
      title: "",
      desc: "",
      tips: "",
      timerSeconds: 0
    });
    this.setData({ "formData.steps": list });
  },

  removeStepRow(e) {
    const idx = e.currentTarget.dataset.index;
    const list = this.data.formData.steps;
    list.splice(idx, 1);
    // 重排 step 编号
    list.forEach((s, i) => s.step = i + 1);
    this.setData({ "formData.steps": list });
  },

  onStepChange(e) {
    const { index, field } = e.currentTarget.dataset;
    let val = e.detail.value;
    if (field === "timerSeconds") {
      val = Number(val) || 0;
    }
    this.setData({
      [`formData.steps[${index}].${field}`]: val
    });
  },

  // 保存菜品
  async saveDish() {
    const { formData } = this.data;
    if (!formData.name.trim()) {
      wx.showToast({ title: "请输入菜品名称", icon: "none" });
      return;
    }

    // 过滤掉完全为空的行
    formData.ingredients = (formData.ingredients || []).filter(i => i.name && i.name.trim());
    formData.seasonings = (formData.seasonings || []).filter(s => s.name && s.name.trim());
    formData.steps = (formData.steps || []).filter(st => (st.title && st.title.trim()) || (st.desc && st.desc.trim()));

    // 补齐 step
    formData.steps.forEach((s, idx) => s.step = idx + 1);

    wx.showLoading({ title: "正在保存菜谱..." });
    try {
      await cloudHelper.saveDish(formData);
      wx.hideLoading();
      wx.showToast({ title: "保存成功", icon: "success" });
      this.closeEditModal();
      this.loadDishes();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: "保存失败", icon: "error" });
    }
  },

  // 删除菜品
  confirmDeleteDish(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: "删除菜品确认",
      content: `确定要从菜单中移除【${name}】吗？`,
      confirmColor: "#E53935",
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: "正在删除..." });
          await cloudHelper.deleteDish(id);
          wx.hideLoading();
          wx.showToast({ title: "已删除", icon: "success" });
          this.loadDishes();
        }
      }
    });
  },

  // 重置回预设经典菜谱
  confirmResetDefault() {
    wx.showModal({
      title: "恢复默认经典菜谱",
      content: "重置后将恢复包含早、中、晚、汤品、夜宵的完整官方预设菜谱与做法，是否继续？",
      confirmColor: "#FA6432",
      success: (res) => {
        if (res.confirm) {
          cloudHelper.resetDefaultDishes();
          this.loadDishes();
          wx.showToast({ title: "已恢复官方菜谱", icon: "success" });
        }
      }
    });
  }
});
