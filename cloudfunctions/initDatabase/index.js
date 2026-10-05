const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口：自动创建 dishes 和 orders 集合
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const results = {};

  try {
    await db.createCollection("dishes");
    results.dishesCollection = "created";
  } catch (e) {
    results.dishesCollection = "exists_or_error: " + e.message;
  }

  try {
    await db.createCollection("orders");
    results.ordersCollection = "created";
  } catch (e) {
    results.ordersCollection = "exists_or_error: " + e.message;
  }

  return {
    success: true,
    openid: wxContext.OPENID,
    results
  };
};
