const User = require("../models/User");

const isAuthenticated = async (req, res, next) => {
  if (req.headers.authorization) {
    const user = await User.findOne({
      token: req.headers.authorization.replace("Bearer ", ""),
    }).select("account");
    if (!user) {
      return res.status(409).json({ error: "Unauthorized" });
    } else {
      req.user = user;
      return next();
    }
  } else {
    return res.status(409).json({ error: "Unauthorized" });
  }
};

module.exports = isAuthenticated;
