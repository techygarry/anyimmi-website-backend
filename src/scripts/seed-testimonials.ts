import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Testimonial } from "../modules/content/testimonial.model.js";

const testimonials = [
  {
    name: "Priya Sharma",
    role: "RCIC, Toronto",
    text: "AnyImmi's bundle completely transformed how I market my practice. The social media templates alone saved me 20+ hours a month. My client inquiries have doubled since I started using their professionally designed materials.",
    rating: 5,
    avatarColor: "#573CFF",
    sortOrder: 1,
    isActive: true,
  },
  {
    name: "David Chen",
    role: "Immigration Consultant, Vancouver",
    text: "As a new consultant, I struggled with creating professional marketing materials. AnyImmi gave me everything I needed — brochures, social posts, email templates — all IRCC-compliant. It's like having a full marketing team at a fraction of the cost.",
    rating: 5,
    avatarColor: "#059669",
    sortOrder: 2,
    isActive: true,
  },
  {
    name: "Sarah Johnson",
    role: "RCIC, Calgary",
    text: "The quality of the templates is outstanding. My clients often comment on how professional my materials look. The editable PSD files make it easy to maintain brand consistency across all my communications.",
    rating: 5,
    avatarColor: "#C8102E",
    sortOrder: 3,
    isActive: true,
  },
  {
    name: "Rajesh Patel",
    role: "Senior RCIC, Mississauga",
    text: "I've been in the immigration business for 15 years and I wish AnyImmi existed when I started. The cover letter templates, SOP guides, and client intake forms are incredibly well-crafted. Worth every penny.",
    rating: 5,
    avatarColor: "#D4A843",
    sortOrder: 4,
    isActive: true,
  },
  {
    name: "Amina Hassan",
    role: "Immigration Consultant, Ottawa",
    text: "The presentation decks helped me win over corporate clients. The professional look instantly builds trust. AnyImmi understands what immigration consultants actually need for their day-to-day operations.",
    rating: 5,
    avatarColor: "#8B5CF6",
    sortOrder: 5,
    isActive: true,
  },
  {
    name: "Michael Torres",
    role: "RCIC, Edmonton",
    text: "Switching to AnyImmi was the best decision for my practice. The invoice templates, client checklists, and consultation forms streamlined my entire workflow. I can focus more on clients and less on paperwork.",
    rating: 4,
    avatarColor: "#3B82F6",
    sortOrder: 6,
    isActive: true,
  },
];

async function seed() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("Connected to MongoDB");

    await Testimonial.deleteMany({});
    console.log("Cleared existing testimonials");

    const created = await Testimonial.insertMany(testimonials);
    console.log(`Seeded ${created.length} testimonials`);

    await mongoose.disconnect();
    console.log("Done");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
}

seed();
