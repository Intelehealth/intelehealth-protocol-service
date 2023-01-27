const { messages, Sequelize } = require("../models");

module.exports = (function () {
  /**
   * Create a message entry
   * @param {string} fromUser
   * @param {string} toUser
   * @param {string} message
   */
  this.sendMessage = async (
    fromUser,
    toUser,
    patientId,
    message,
    isRead,
    patientPic,
    visitId,
    patientName,
    hwName,
    hwPic
  ) => {
    try {
      return {
        success: true,
        data: await messages.create({
          fromUser,
          toUser,
          patientId,
          message,
          isRead,
          patientPic,
          visitId,
          patientName,
          hwName,
          hwPic,
        }),
      };
    } catch (error) {
      console.log("error: sendMessage ", error);
      return {
        success: false,
        data: error,
      };
    }
  };

  /**
   * Return all the chats between 2 users with visits
   * @param {string} fromUserUuid
   * @param {string} toUserUuid
   * @returns []Array
   */
  this.getMessages = async (fromUser, toUser, patientId, visitId) => {
    try {
      if (!visitId) {
        const latestVisit = await messages.findAll({
          where: {
            fromUser: { [Sequelize.Op.in]: [fromUser, toUser] },
            toUser: { [Sequelize.Op.in]: [toUser, fromUser] },
            patientId,
          },
          attributes: [
            [
              Sequelize.fn("DISTINCT", Sequelize.col("patientName")),
              "patientName",
            ],
            "patientPic",
            "message",
            "isRead",
            "fromUser",
            "toUser",
            "visitId",
            "hwName",
            "createdAt",
          ],
          order: [["createdAt", "DESC"]],
        });
        if (latestVisit.length) {
          visitId = latestVisit[0].visitId;
        }
      }

      let data = await messages.findAll({
        where: {
          fromUser: { [Sequelize.Op.in]: [fromUser, toUser] },
          toUser: { [Sequelize.Op.in]: [toUser, fromUser] },
          patientId,
          visitId,
        },
        raw: true,
      });
      for (let i = 0; i < data.length; i++) {
        try {
          data[i].createdAt = new Date(data[i].createdAt).toGMTString();
        } catch (error) {}
      }
      return { success: true, data };
    } catch (error) {
      console.log("error: getMessages ", error);
      return {
        success: false,
        data: [],
      };
    }
  };

  /**
   * Return all the chats between 2 users without patient id
   * @param {string} fromUserUuid
   * @param {string} toUserUuid
   * @returns []Array
   */
  this.getAllMessages = async (fromUser, toUser) => {
    try {
      const data = await messages.findAll({
        where: {
          fromUser: { [Sequelize.Op.in]: [fromUser, toUser] },
          toUser: { [Sequelize.Op.in]: [toUser, fromUser] },
        },
      });
      for (let i = 0; i < data.length; i++) {
        try {
          data[i].dataValues.createdAt = new Date(
            data[i].dataValues.createdAt
          ).toGMTString();
        } catch (error) {}
      }
      return { success: true, data };
    } catch (error) {
      console.log("error: getMessages ", error);
      return {
        success: false,
        data: [],
      };
    }
  };

  /**
   * Return all the chats for patients
   * @returns []Array
   */
  this.getPatientMessageList = async () => {
    try {
      const data = await messages.findAll({
        attributes: [
          [
            Sequelize.fn("DISTINCT", Sequelize.col("patientName")),
            "patientName",
          ],
          "patientId",
          "patientPic",
          "message",
          "isRead",
          "fromUser",
          "toUser",
          "visitId",
          "hwName",
          "createdAt",
        ],
        order: [["createdAt", "DESC"]],
        group: ["patientName"],
        where: {
          patientName: {
            [Sequelize.Op.ne]: null,
          },
        },
      });
      return { success: true, data };
    } catch (error) {
      console.log("error: getMessages ", error);
      return {
        success: false,
        data: [],
      };
    }
  };

  /**
   * Return no of updated documents
   * @param {string} messageId
   * @returns []Array
   */
  this.readMessagesById = async (messageId) => {
    try {
      const getMessage = await messages.findAll({
        where: {
          id: messageId,
        },
      });

      if (getMessage) {
        const data = await messages.update(
          { isRead: true },
          {
            where: {
              fromUser: [getMessage[0].fromUser],
              toUser: [getMessage[0].toUser],
              patientId: [getMessage[0].patientId],
            },
          }
        );
        return { success: true, data };
      }
      return { success: false, data: [] };
    } catch (error) {
      console.log("error: getMessages ", error);
      return {
        success: false,
        data: [],
      };
    }
  };

  /**
   * Return all the visits for patients
   * @returns []Array
   */
  this.getVisits = async (patientId) => {
    try {
      const data = await messages.findAll({
        attributes: ["visitId", "createdAt"],
        where: { patientId },
        order: [["createdAt", "DESC"]],
        group: ["visitId"],
      });
      return { success: true, data };
    } catch (error) {
      console.log("error: getMessages ", error);
      return {
        success: false,
        data: [],
      };
    }
  };

  return this;
})();
