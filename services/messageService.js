import Message from "../models/messageModel.js";

const getAllMessages = () => Message.find({}).lean();

const createMessage = (messageData) => Message.create(messageData);

export { createMessage, getAllMessages };
