import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Announcement title is required"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Announcement content is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["Company News", "Policy Update", "General", "Urgent", "Event", "Holiday"],
      default: "Company News",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    author: {
      type: String,
      default: "Management / HR",
    },
    authorRole: {
      type: String,
      default: "admin",
    },
    targetAudience: {
      type: String,
      enum: ["all", "employees", "department"],
      default: "all",
    },
    department: {
      type: String,
      default: "All",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    expiresAt: {
      type: Date,
      default: null,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanySettings",
      index: true,
      default: null,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanySettings",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

announcementSchema.pre("validate", async function () {
  if (!this.organizationId && this.companyId) this.organizationId = this.companyId;
  if (!this.companyId && this.organizationId) this.companyId = this.organizationId;
  if (!this.companyId && mongoose.connection.readyState === 1) {
    try {
      const comp = await mongoose.model("CompanySettings").findOne().select("_id").lean();
      if (comp && comp._id) {
        this.companyId = comp._id;
        if (!this.organizationId) this.organizationId = comp._id;
      }
    } catch {
      // ignore
    }
  }
});

// Compound indexes for multi-tenant query performance and fast sorting
announcementSchema.index({ companyId: 1, _id: 1 });
announcementSchema.index({ organizationId: 1, _id: 1 });
announcementSchema.index({ isPinned: -1, createdAt: -1 });
announcementSchema.index({ organizationId: 1, isPinned: -1, createdAt: -1 });
announcementSchema.index({ companyId: 1, isPinned: -1, createdAt: -1 });
announcementSchema.index({ companyId: 1, category: 1 });
announcementSchema.index({ companyId: 1, targetAudience: 1 });

export const Announcement =
  mongoose.models.Announcement ||
  mongoose.model("Announcement", announcementSchema, "announcements");

export default Announcement;
