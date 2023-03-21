const { RES } = require("../handlers/helper");
const {
    sendMessage,
    readMessage,
    getMessages,
    getSystemAdministrators,
    getDoctorsList
} = require("../services/support.service");

module.exports = (function () {
    /**
     * Send support message
     * @param {*} req
     * @param {*} res
     */
    this.sendMessage = async (req, res) => {
        try {
            const { from, to, message, type } = req.body;
            if (from && to && message && type) {
                const data = await sendMessage(from, to, message, type);
                const messages = await getMessages(from, to);
                if (data.data.dataValues.to == 'System Administrator') {
                    const systemAdministrators = (await getSystemAdministrators()).map(u => u.uuid);
                    for (const key in users) {
                        if (Object.hasOwnProperty.call(users, key)) {
                            const user = users[key];
                            for (const u of systemAdministrators) {
                                if (user && user.uuid == u) {
                                    data.data.dataValues.createdAt = new Date(data.data.dataValues.createdAt).toGMTString();
                                    data.data.dataValues.allMessages = messages.data;
                                    io.to(key).emit("supportMessage", data.data);
                                }
                            }
                        }
                    }
                } else {
                    for (const key in users) {
                        if (Object.hasOwnProperty.call(users, key)) {
                          const user = users[key];
                          if (user && user.uuid == to) {
                            data.data.dataValues.createdAt = new Date(data.data.dataValues.createdAt).toGMTString();
                            data.data.dataValues.allMessages = messages.data;
                            io.to(key).emit("supportMessage", data.data);
                          }
                        }
                    }
                }
                
                RES(
                    res,
                    {
                      success: data.success,
                      message: data.message,
                      data: data.data,
                    },
                    data.code
                );
            } else {
                RES(
                    res, 
                    { success: false, message: "Bad request! Invalid arguments.", data: null }, 
                    400
                );
            }
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            RES(
                res,
                { success: false, data: error.data, message: error.message },
                error.code
            );
        }
    };

    /**
     * Mark message as read by messageId
     * @param {*} req
     * @param {*} res
     */
    this.readMessage = async (req, res) => {
        try {
            const { userId, messageId } = req.params;
            if (userId, messageId) {
                const data = await readMessage(userId, messageId);
                RES(
                    res,
                    {
                      success: data.success,
                      message: data.message,
                      data: data.data,
                    },
                    data.code
                );
            } else {
                RES(
                    res, 
                    { success: false, message: "Bad request! Invalid arguments.", data: null }, 
                    400
                );
            }
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            RES(
                res,
                { success: false, data: error.data, message: error.message },
                error.code
            );
        }
    };

    /**
     * Get all support messages between from and to user.
     * @param {*} req
     * @param {*} res
     */
    this.getMessages = async (req, res) => {
        try {
            const { from, to } = req.params;
            if (from, to) {
                const data = await getMessages(from, to);
                RES(
                    res,
                    {
                      success: data.success,
                      message: data.message,
                      data: data.data,
                    },
                    data.code
                );
            } else {
                RES(
                    res, 
                    { success: false, message: "Bad request! Invalid arguments.", data: null }, 
                    400
                );
            }
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            RES(
                res,
                { success: false, data: error.data, message: error.message },
                error.code
            );
        }
    };

    /**
     * Get Dr's list raised support messages.
     * @param {*} req
     * @param {*} res
     */
    this.getDoctorsList = async (req, res) => {
        try {
            const { userId } = req.params;
            if (userId) {
                const data = await getDoctorsList(userId);
                RES(
                    res,
                    {
                      success: data.success,
                      message: data.message,
                      data: data.data,
                    },
                    data.code
                );
            } else {
                RES(
                    res, 
                    { success: false, message: "Bad request! Invalid arguments.", data: null }, 
                    400
                );
            }
        } catch (error) {
            if (error.code === null || error.code === undefined) {
                error.code = 500;
            }
            RES(
                res,
                { success: false, data: error.data, message: error.message },
                error.code
            );
        }
    };

    return this;
})();
