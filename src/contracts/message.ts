export interface CreateMessageInput {
  name: string;
  message: string;
}

export interface MessageRecord extends CreateMessageInput {
  _id: unknown;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}
