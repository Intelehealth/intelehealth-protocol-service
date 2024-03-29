const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const { authMiddleware } = require("./handlers/checkAuth");
const indexRouter = require("./routes/index");
const authRouter = require("./routes/auth");
const { errorHandler } = require("./handlers/errorHandller");
const cors = require("cors");

const app = express();
app.set("view engine", "html");

app.use(cors());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/auth", authRouter);
app.use("/v2", authMiddleware, indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(errorHandler);

module.exports = app;
