import mongoose from "mongoose";

const buildDatabaseUri = () => {
  const { DATABASE, DB_PASSWORD } = process.env;

  if (!DATABASE || !DB_PASSWORD) {
    throw new Error("DATABASE and DB_PASSWORD env vars are required");
  }

  return DATABASE.replace("<db_password>", DB_PASSWORD);
};

const connectDatabase = async () => {
  const databaseUri = buildDatabaseUri();

  await mongoose.connect(databaseUri);
  console.log("DB connection successful");
};

export default connectDatabase;
