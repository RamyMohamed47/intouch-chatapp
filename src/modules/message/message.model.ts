import { Schema, model } from "mongoose";

import type { CreateMessageInput } from "../../contracts/message.js";

const messageSchema = new Schema<CreateMessageInput>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

const MessageModel = model<CreateMessageInput>("Message", messageSchema);

export default MessageModel;
