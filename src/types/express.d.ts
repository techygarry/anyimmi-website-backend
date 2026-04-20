import { IUser } from "../modules/users/user.model.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: IUser;
  }
}
