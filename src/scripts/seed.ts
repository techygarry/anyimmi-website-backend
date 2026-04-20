import "dotenv/config";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { User } from "../modules/users/user.model.js";
import { Category } from "../modules/assets/category.model.js";
import { Asset } from "../modules/assets/asset.model.js";
import { Order } from "../modules/payments/order.model.js";

const s3 = new S3Client({
  endpoint: env.DO_SPACES_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  region: env.DO_SPACES_REGION,
  credentials: {
    accessKeyId: env.DO_SPACES_KEY,
    secretAccessKey: env.DO_SPACES_SECRET,
  },
});

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.DO_SPACES_BUCKET }));
    console.log(`Bucket "${env.DO_SPACES_BUCKET}" already exists.`);
  } catch {
    console.log(`Creating bucket "${env.DO_SPACES_BUCKET}"...`);
    await s3.send(new CreateBucketCommand({ Bucket: env.DO_SPACES_BUCKET }));
    console.log(`Bucket "${env.DO_SPACES_BUCKET}" created.`);
  }
}

async function uploadSampleFile(key: string, content: string, contentType: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.DO_SPACES_BUCKET,
      Key: key,
      Body: Buffer.from(content),
      ContentType: contentType,
    })
  );
}

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  // 1. Ensure S3/MinIO bucket exists
  await ensureBucket();

  // 2. Seed admin user
  const existingAdmin = await User.findOne({ email: "admin@anyimmi.com" });
  if (!existingAdmin) {
    const hashedPassword = await bcryptjs.hash("Admin123!", 12);
    await User.create({
      name: "Admin",
      email: "admin@anyimmi.com",
      password: hashedPassword,
      role: "admin",
      plan: "business",
      isEmailVerified: true,
    });
    console.log("Admin user created (admin@anyimmi.com / Admin123!)");
  } else {
    console.log("Admin user already exists.");
  }

  // 3. Seed test user
  const existingTestUser = await User.findOne({ email: "test@anyimmi.com" });
  if (!existingTestUser) {
    const hashedPassword = await bcryptjs.hash("Test1234!", 12);
    await User.create({
      name: "Test User",
      email: "test@anyimmi.com",
      password: hashedPassword,
      role: "user",
      plan: "pro",
      isEmailVerified: true,
    });
    console.log("Test user created (test@anyimmi.com / Test1234!)");
  } else {
    console.log("Test user already exists.");
  }

  // 3b. Seed expired Pro user (bundle purchased but portal pro expired)
  const existingExpired = await User.findOne({ email: "expired@anyimmi.com" });
  if (!existingExpired) {
    const hashedPassword = await bcryptjs.hash("Expired1!", 12);
    const expiredDate = new Date();
    expiredDate.setMonth(expiredDate.getMonth() - 1); // Expired 1 month ago

    const expiredUser = await User.create({
      name: "Expired Pro User",
      email: "expired@anyimmi.com",
      password: hashedPassword,
      role: "user",
      plan: "free", // Plan reverted to free after expiry
      portalProExpiresAt: expiredDate,
      isEmailVerified: true,
    });

    // Create a past order for this user to simulate a real bundle purchase
    await Order.create({
      userId: expiredUser._id,
      email: "expired@anyimmi.com",
      name: "Expired Pro User",
      stripeSessionId: "seed_expired_session_001",
      stripePaymentIntent: "seed_expired_pi_001",
      tier: "starter",
      amount: 97,
      currency: "usd",
      status: "completed",
      deliveryStatus: "email_sent",
      portalAccessGranted: true,
      portalProMonths: 3,
    });

    console.log("Expired Pro user created (expired@anyimmi.com / Expired1!)");
    console.log("  → Portal Pro expired 1 month ago, plan reverted to free");
    console.log("  → Has starter bundle order history ($97)");
  } else {
    console.log("Expired Pro user already exists.");
  }

  // 4. Seed categories
  const categories = [
    {
      name: "Social Media Posts",
      slug: "social-media-posts",
      description: "Eye-catching post templates for Instagram, Facebook, and LinkedIn. Immigration-focused content that drives engagement and grows your following.",
      longDescription: "Transform your social media presence with 150+ professionally designed post templates built specifically for immigration consultants. Each template is fully editable in Photoshop, allowing you to customize colours, text, images, and branding to match your practice. From Express Entry announcements to study permit tips, these templates cover every immigration topic your audience cares about.",
      icon: "Share2",
      fileCount: "150+",
      features: ["Instagram feed posts", "Facebook post designs", "LinkedIn professional posts", "Multiple colour schemes", "Fully layered PSD files", "IRCC-compliant messaging"],
      useCases: ["Announce Express Entry draw results", "Share immigration tips and updates", "Promote your consultation services", "Celebrate client success stories", "Post CRS score breakdowns", "Share visa processing timelines"],
      sortOrder: 1,
    },
    {
      name: "Story Templates",
      slug: "story-templates",
      description: "Instagram and Facebook story templates. Share immigration tips, client testimonials, and service highlights in a visually stunning vertical format.",
      longDescription: "Engage your audience with 50+ vertical story templates designed for Instagram and Facebook Stories. These templates feature bold typography, eye-catching layouts, and immigration-specific content that drives swipe-ups and direct messages. Perfect for sharing quick tips, behind-the-scenes content, and time-sensitive announcements.",
      icon: "Smartphone",
      fileCount: "50+",
      features: ["9:16 vertical format", "Instagram & Facebook compatible", "Swipe-up CTA designs", "Poll and quiz templates", "Animated-ready layouts", "Highlight cover designs"],
      useCases: ["Share daily immigration tips", "Post client testimonial highlights", "Announce webinar or seminar dates", "Run polls about immigration topics", "Share behind-the-scenes of your practice", "Promote limited-time consultation offers"],
      sortOrder: 2,
    },
    {
      name: "Carousel Posts",
      slug: "carousel-posts",
      description: "Multi-slide carousel templates perfect for explaining visa processes, eligibility criteria, and step-by-step immigration guides.",
      longDescription: "Break down complex immigration processes into digestible, swipeable carousels with 30+ multi-slide templates. Each carousel set includes 5-10 slides with consistent branding, perfect for educational content that gets saved and shared. Ideal for explaining visa pathways, document checklists, and eligibility criteria in a visual format.",
      icon: "Layout",
      fileCount: "30+",
      features: ["5-10 slides per set", "Consistent slide branding", "Educational layouts", "Infographic-style designs", "Numbered step formats", "Save-worthy content designs"],
      useCases: ["Explain Express Entry step by step", "Break down CRS scoring criteria", "Show document checklists by visa type", "Compare immigration pathways", "Explain PGWP eligibility requirements", "Create FAQ carousel series"],
      sortOrder: 3,
    },
    {
      name: "Reels Covers",
      slug: "reels-covers",
      description: "Professionally designed reel cover templates to make your video content look polished and on-brand across social platforms.",
      longDescription: "Give your Instagram Reels and TikTok videos a professional, cohesive look with 25+ cover templates. These covers ensure your video grid looks organized and branded, making your profile stand out as a credible immigration professional. Each cover is designed to grab attention and clearly communicate the topic of your video content.",
      icon: "Monitor",
      fileCount: "25+",
      features: ["9:16 cover format", "Grid-consistent designs", "Bold title typography", "Category colour coding", "Instagram & TikTok compatible", "Thumbnail-optimized layouts"],
      useCases: ["Create cohesive Reels grid on your profile", "Label educational video series", "Brand your immigration tip videos", "Organize content by visa category", "Make video content look professional", "Stand out in followers' feeds"],
      sortOrder: 4,
    },
    {
      name: "Email Templates",
      slug: "email-templates",
      description: "Templates for newsletters, follow-ups, onboarding sequences, and client communications. Boost your email marketing game.",
      longDescription: "Streamline your email communications with 40+ professionally designed email templates covering newsletters, follow-ups, onboarding sequences, and client updates. Each template is crafted with immigration-specific content sections, making it easy to maintain regular contact with clients and leads while looking professional and trustworthy.",
      icon: "Mail",
      fileCount: "40+",
      features: ["Newsletter layouts", "Follow-up sequences", "Onboarding email series", "Appointment reminders", "Status update templates", "Mobile-responsive designs"],
      useCases: ["Send weekly immigration newsletters", "Follow up after initial consultations", "Onboard new clients professionally", "Send visa status update notifications", "Share policy change announcements", "Nurture leads with drip campaigns"],
      sortOrder: 5,
    },
    {
      name: "Brochures",
      slug: "brochures",
      description: "Professional brochure designs to showcase your services, pricing, and success stories. Perfect for client meetings and events.",
      longDescription: "Present your immigration consulting services with 20+ stunning brochure templates. From tri-fold brochures for events to detailed service guides for client meetings, each design combines professional layouts with immigration-specific content sections. Perfect for print and digital distribution at seminars, exhibitions, and client consultations.",
      icon: "Bookmark",
      fileCount: "20+",
      features: ["Tri-fold and bi-fold layouts", "Service showcase sections", "Pricing table designs", "Client testimonial areas", "Print-ready CMYK files", "Digital PDF versions"],
      useCases: ["Hand out at immigration seminars", "Leave at community centres and libraries", "Send as digital PDFs to prospective clients", "Display at trade show booths", "Include in welcome kit packages", "Share at networking events"],
      sortOrder: 6,
    },
    {
      name: "Flyers",
      slug: "flyers",
      description: "Flyer templates for seminars, webinars, open houses, and promotional campaigns. Grab attention with professional layouts.",
      longDescription: "Promote your events, services, and special offers with 25+ attention-grabbing flyer templates. Designed for both print and digital use, these flyers cover seminar announcements, webinar promotions, free consultation offers, and seasonal campaigns. Each template features bold headlines, clear call-to-actions, and professional imagery.",
      icon: "Megaphone",
      fileCount: "25+",
      features: ["A4 and Letter sizes", "Event promotion layouts", "Service highlight designs", "QR code placement areas", "Print and digital optimized", "Bold call-to-action sections"],
      useCases: ["Promote immigration seminars and webinars", "Advertise free consultation offers", "Announce new service launches", "Create seasonal promotional campaigns", "Distribute at community events", "Post on community bulletin boards"],
      sortOrder: 7,
    },
    {
      name: "Business Cards",
      slug: "business-cards",
      description: "Modern business card designs that make a lasting first impression. RCIC-branded with your credentials prominently displayed.",
      longDescription: "Make a memorable first impression with 15+ modern business card designs tailored for immigration consultants. Each template prominently features RCIC/CICC credentials, professional designations, and multiple contact methods. Available in standard and premium formats with front and back designs.",
      icon: "Briefcase",
      fileCount: "15+",
      features: ["Front and back designs", "RCIC credential placement", "Multiple contact fields", "QR code ready", "Standard 3.5x2 inch size", "Print-ready 300 DPI"],
      useCases: ["Hand out at networking events", "Include with client welcome packages", "Leave at referral partner offices", "Distribute at immigration fairs", "Share at chamber of commerce meetings", "Attach to professional correspondence"],
      sortOrder: 8,
    },
    {
      name: "Letterheads",
      slug: "letterheads",
      description: "Professional letterhead templates for official correspondence, client letters, and documentation with your branding.",
      longDescription: "Elevate your official correspondence with 10+ professional letterhead templates. These designs reinforce your brand identity on every document you send, from client recommendation letters to official notices. Each template includes space for your logo, credentials, contact information, and professional designations.",
      icon: "FileText",
      fileCount: "10+",
      features: ["A4 and Letter sizes", "Logo placement headers", "RCIC credential areas", "Contact info footers", "Matching envelope designs", "Word and PSD formats"],
      useCases: ["Write official client letters", "Send recommendation letters", "Create professional cover pages", "Issue formal notices and agreements", "Prepare retainer agreement documents", "Send post-consultation summaries"],
      sortOrder: 9,
    },
    {
      name: "WhatsApp Status",
      slug: "whatsapp-status",
      description: "WhatsApp status templates to keep your contacts engaged with immigration updates, tips, and service promotions.",
      longDescription: "Stay top-of-mind with your WhatsApp contacts using 30+ status templates designed for immigration consultants. These vertical templates are optimized for WhatsApp Status with bold text, vibrant designs, and quick-read immigration tips that encourage direct messages and inquiries.",
      icon: "Phone",
      fileCount: "30+",
      features: ["WhatsApp-optimized dimensions", "Quick-read tip formats", "Service promotion designs", "CTA for direct messaging", "Festive and seasonal themes", "Bold and readable typography"],
      useCases: ["Share daily immigration tips", "Promote free consultation slots", "Announce visa policy updates", "Share client success milestones", "Post festive greetings with branding", "Drive inquiries via WhatsApp DM"],
      sortOrder: 10,
    },
    {
      name: "Website Banners",
      slug: "website-banners",
      description: "Website banner designs for hero sections, promotions, and announcements. Optimized for web display and fast loading.",
      longDescription: "Upgrade your website with 20+ professionally designed banner templates. From hero section banners to promotional strips and announcement bars, each design is optimized for web display with proper dimensions and fast-loading formats. Keep your website looking fresh and professional year-round.",
      icon: "Globe",
      fileCount: "20+",
      features: ["Hero section banners", "Sidebar ad banners", "Announcement strip designs", "Retina-ready resolution", "Multiple standard web sizes", "CTA button placements"],
      useCases: ["Update your website hero section", "Create seasonal promotional banners", "Announce new services or programs", "Highlight client testimonials", "Promote upcoming events and webinars", "Feature special consultation offers"],
      sortOrder: 11,
    },
    {
      name: "Client Forms",
      slug: "client-forms",
      description: "Intake forms, assessment questionnaires, and client onboarding documents. Streamline your consultation process.",
      longDescription: "Streamline your client management with 35+ professionally designed form templates. From initial intake forms to detailed assessment questionnaires, each form is structured to capture the right information for different immigration pathways. Save time on paperwork and impress clients with your organized, professional process.",
      icon: "FileText",
      fileCount: "35+",
      features: ["Initial intake forms", "Assessment questionnaires", "Document checklists", "Retainer agreements", "Client information sheets", "Fillable PDF formats"],
      useCases: ["Collect client information efficiently", "Assess eligibility for different programs", "Provide document requirement checklists", "Standardize your consultation process", "Onboard new clients smoothly", "Track client document submissions"],
      sortOrder: 12,
    },
    {
      name: "Presentation Decks",
      slug: "presentation-decks",
      description: "Presentation templates for client consultations, webinars, and seminar presentations. Professional and informative.",
      longDescription: "Deliver impactful presentations with 10+ professionally designed deck templates. Each presentation includes 20-30 slides covering immigration pathways, service overviews, process explanations, and client onboarding. Perfect for webinars, seminar talks, and one-on-one client consultations.",
      icon: "BarChart3",
      fileCount: "10+",
      features: ["20-30 slides per deck", "Speaker notes included", "Data visualization slides", "Client onboarding decks", "Webinar presentation formats", "PowerPoint and PSD formats"],
      useCases: ["Present at immigration seminars", "Conduct webinars professionally", "Walk clients through visa pathways", "Pitch your services to corporate clients", "Train your team on processes", "Present at community information sessions"],
      sortOrder: 13,
    },
    {
      name: "Invoice Templates",
      slug: "invoice-templates",
      description: "Professional invoice designs for your consulting fees. Clean, branded, and easy to customize with your rates.",
      longDescription: "Get paid professionally with 8+ clean, branded invoice templates designed for immigration consulting fees. Each template includes proper tax fields, service descriptions, payment terms, and your branding. Available in editable PSD and fillable PDF formats for easy customization with your specific rates and services.",
      icon: "Calendar",
      fileCount: "8+",
      features: ["Tax calculation fields", "Service description areas", "Payment terms section", "Multiple currency support", "Auto-numbering ready", "Editable PSD and PDF"],
      useCases: ["Bill clients for consultation fees", "Invoice for document preparation services", "Create retainer fee invoices", "Issue receipts for payments received", "Track outstanding payments", "Maintain professional billing records"],
      sortOrder: 14,
    },
    {
      name: "Welcome Kits",
      slug: "welcome-kits",
      description: "Complete client welcome kit packages with guides, checklists, and onboarding materials to impress new clients.",
      longDescription: "Make an unforgettable first impression with 5+ complete welcome kit packages. Each kit includes a welcome letter, service guide, process timeline, document checklist, and FAQ sheet — all branded and coordinated. These kits set the tone for a professional client relationship from day one.",
      icon: "Award",
      fileCount: "5+",
      features: ["Welcome letter templates", "Service guide booklets", "Process timeline graphics", "Document checklist inserts", "FAQ information sheets", "Coordinated branding throughout"],
      useCases: ["Onboard new clients professionally", "Set expectations from the start", "Reduce repetitive client questions", "Differentiate from competitors", "Build client trust and confidence", "Create a premium service experience"],
      sortOrder: 15,
    },
    {
      name: "Consultation Checklists",
      slug: "consultation-checklists",
      description: "Checklists for different visa types, PR applications, and consultation workflows. Keep your process organized.",
      longDescription: "Stay organized and never miss a step with 15+ detailed checklist templates covering every major immigration pathway. From Express Entry to study permits, each checklist walks through required documents, application steps, and key deadlines. Perfect for keeping both you and your clients on track throughout the process.",
      icon: "Shield",
      fileCount: "15+",
      features: ["Visa-specific checklists", "PR application workflows", "Document tracking sheets", "Deadline reminder formats", "Client-facing versions", "Internal process checklists"],
      useCases: ["Guide clients through document preparation", "Track application progress by visa type", "Ensure no required document is missed", "Standardize your consultation workflow", "Provide clients with clear next steps", "Manage multiple client applications"],
      sortOrder: 16,
    },
    {
      name: "Social Proof Kits",
      slug: "social-proof-kits",
      description: "Templates for showcasing client testimonials, success stories, and case studies. Build trust and credibility.",
      longDescription: "Build trust and credibility with 12+ social proof templates designed to showcase your client success stories, testimonials, and case studies. From visual testimonial cards for social media to detailed case study layouts for your website, these templates help you convert prospects by demonstrating real results.",
      icon: "Star",
      fileCount: "12+",
      features: ["Testimonial card designs", "Case study layouts", "Before/after formats", "Video testimonial thumbnails", "Google review highlights", "Success metric showcases"],
      useCases: ["Share client testimonials on social media", "Create case study PDFs for your website", "Showcase approval success rates", "Highlight client journey stories", "Build a portfolio of success stories", "Use in sales presentations and proposals"],
      sortOrder: 17,
    },
  ];

  const categoryMap: Record<string, mongoose.Types.ObjectId> = {};

  for (const cat of categories) {
    const existing = await Category.findOne({ slug: cat.slug });
    if (!existing) {
      const created = await Category.create(cat);
      categoryMap[cat.slug] = created._id;
      console.log(`Category created: ${cat.name}`);
    } else {
      categoryMap[cat.slug] = existing._id;
    }
  }

  // 5. Upload sample files to MinIO and seed assets
  const sampleAssets = [
    {
      name: "Express Entry Social Media Post Pack",
      description: "10 social media post templates for Express Entry announcements and CRS tips.",
      category: categoryMap["social-media-posts"],
      tags: ["express-entry", "social-media", "template"],
      fileFormat: "psd" as const,
      programType: ["express-entry"],
      fileKey: "assets/sample-social-post.psd",
    },
    {
      name: "Immigration Tips Story Pack",
      description: "5 Instagram story templates for sharing quick immigration tips.",
      category: categoryMap["story-templates"],
      tags: ["story", "instagram", "tips"],
      fileFormat: "psd" as const,
      programType: ["general"],
      fileKey: "assets/sample-story-pack.psd",
    },
    {
      name: "Visa Pathway Carousel Set",
      description: "8-slide carousel explaining Canadian visa pathways for social media.",
      category: categoryMap["carousel-posts"],
      tags: ["carousel", "visa", "education"],
      fileFormat: "psd" as const,
      programType: ["general"],
      fileKey: "assets/sample-carousel.psd",
    },
    {
      name: "Client Intake Form Template",
      description: "Comprehensive intake form for initial immigration consultations.",
      category: categoryMap["client-forms"],
      tags: ["form", "intake", "consultation"],
      fileFormat: "pdf" as const,
      programType: ["general"],
      fileKey: "assets/sample-intake-form.pdf",
    },
    {
      name: "Immigration Seminar Flyer",
      description: "Event flyer template for promoting immigration seminars and workshops.",
      category: categoryMap["flyers"],
      tags: ["flyer", "event", "seminar"],
      fileFormat: "psd" as const,
      programType: ["general"],
      fileKey: "assets/sample-flyer.psd",
    },
    {
      name: "PR Application Checklist",
      description: "Step-by-step document checklist for permanent residency applications.",
      category: categoryMap["consultation-checklists"],
      tags: ["checklist", "pr", "documents"],
      fileFormat: "pdf" as const,
      programType: ["express-entry"],
      fileKey: "assets/sample-checklist.pdf",
    },
  ];

  for (const assetData of sampleAssets) {
    const existing = await Asset.findOne({ name: assetData.name });
    if (existing) {
      console.log(`Asset already exists: ${assetData.name}`);
      continue;
    }

    // Upload a placeholder file to MinIO
    const sampleContent = `Sample file: ${assetData.name}\nThis is a placeholder file for development testing.`;
    await uploadSampleFile(assetData.fileKey, sampleContent, "application/octet-stream");

    const fileUrl = env.S3_FORCE_PATH_STYLE
      ? `${env.DO_SPACES_ENDPOINT}/${env.DO_SPACES_BUCKET}/${assetData.fileKey}`
      : `${env.DO_SPACES_ENDPOINT}/${env.DO_SPACES_BUCKET}/${assetData.fileKey}`;

    await Asset.create({
      name: assetData.name,
      description: assetData.description,
      category: assetData.category,
      tags: assetData.tags,
      fileFormat: assetData.fileFormat,
      fileUrl,
      programType: assetData.programType,
    });

    console.log(`Asset created: ${assetData.name}`);
  }

  // Update category asset counts
  for (const [slug, catId] of Object.entries(categoryMap)) {
    const count = await Asset.countDocuments({ category: catId });
    await Category.findByIdAndUpdate(catId, { assetCount: count });
    if (count > 0) {
      console.log(`Updated ${slug} asset count: ${count}`);
    }
  }

  console.log("\nSeed completed successfully!");
  console.log("---");
  console.log("Admin login:        admin@anyimmi.com / Admin123!");
  console.log("Test user login:    test@anyimmi.com / Test1234!");
  console.log("Expired Pro login:  expired@anyimmi.com / Expired1! (Pro expired, plan=free)");
  console.log(`MinIO Console: http://localhost:9001`);
  console.log(`MinIO API: ${env.DO_SPACES_ENDPOINT}`);
  console.log(`Bucket: ${env.DO_SPACES_BUCKET}`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
