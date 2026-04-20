import { Router, Request, Response, NextFunction } from "express";
import { Contact } from "./contact.model.js";
import { sendResponse } from "../../utils/apiResponse.js";
import { AppError } from "../../utils/apiError.js";

const router = Router();

// Public: submit a contact form
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      throw new AppError("Name, email and message are required", 400);
    }
    const contact = await Contact.create({ name, email, subject, message });
    sendResponse(res, 201, { id: contact._id }, "Message sent successfully");
  } catch (err) {
    next(err);
  }
});

export default router;
