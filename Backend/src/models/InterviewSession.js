const mongoose = require('mongoose');

/**
 * InterviewSession — tracks the live, real-time execution of an interview.
 *
 * Lifecycle: Booking (confirmed) → InterviewSession (created) → in-progress → ended
 *
 * This model is separate from Booking intentionally:
 *   - Booking is a *scheduling contract* (who, when, how much).
 *   - InterviewSession captures *what happened* during the live session
 *     (join times, recording, code snapshots, chat log, performance metrics).
 */

// ─── Sub-schemas ──────────────────────────────────────────────────────────────
const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['user', 'interviewer'], required: true },
    joinedAt: Date,
    leftAt: Date,
    // Connection metadata
    ipAddress: { type: String, select: false },
    userAgent: { type: String, select: false },
    // Whether the participant was present for the majority of the session
    wasPresent: { type: Boolean, default: false },
  },
  { _id: false }
);

const codeSnapshotSchema = new mongoose.Schema(
  {
    language: { type: String, required: true, trim: true },
    code: { type: String, maxlength: 100000 },
    savedAt: { type: Date, default: Date.now },
    savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    label: { type: String, trim: true, maxlength: 100 }, // e.g. "Final answer"
  },
  { _id: true }
);

const chatMessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    type: { type: String, enum: ['text', 'code', 'system'], default: 'text' },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const recordingSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    duration: { type: Number, min: 0 }, // seconds
    sizeBytes: { type: Number, min: 0 },
    provider: { type: String, enum: ['aws_s3', 'gcs', 'cloudinary', 'local'], default: 'aws_s3' },
    key: { type: String, trim: true, select: false }, // storage key — sensitive
    status: { type: String, enum: ['processing', 'ready', 'failed', 'deleted'], default: 'processing' },
    processedAt: Date,
    expiresAt: Date, // recordings may be purged after N days
  },
  { _id: false }
);

const technicalEvaluationSchema = new mongoose.Schema(
  {
    // Scores set by the interviewer at end of session
    problemSolving: { type: Number, min: 1, max: 10 },
    codeQuality: { type: Number, min: 1, max: 10 },
    technicalKnowledge: { type: Number, min: 1, max: 10 },
    communication: { type: Number, min: 1, max: 10 },
    timeManagement: { type: Number, min: 1, max: 10 },
    overallScore: { type: Number, min: 1, max: 10 },
    summary: { type: String, trim: true, maxlength: 3000 },
    strengths: [{ type: String, trim: true }],
    areasToImprove: [{ type: String, trim: true }],
    hiringRecommendation: {
      type: String,
      enum: ['strong_yes', 'yes', 'maybe', 'no', 'strong_no'],
    },
    evaluatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const interviewSessionSchema = new mongoose.Schema(
  {
    // 1-to-1 with Booking
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
      unique: true,
    },
    // Denormalised for quick querying without populating Booking
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interviewer',
      required: [true, 'Interviewer reference is required'],
    },
    status: {
      type: String,
      enum: ['scheduled', 'waiting', 'in-progress', 'ended', 'no-show', 'aborted'],
      default: 'scheduled',
    },
    // Meeting room identifiers
    roomId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    meetingLink: { type: String, trim: true },
    meetingProvider: {
      type: String,
      enum: ['jitsi', 'zoom', 'google_meet', 'webrtc', 'other'],
      default: 'jitsi',
    },
    // Timeline
    scheduledStartAt: {
      type: Date,
      required: [true, 'Scheduled start time is required'],
    },
    scheduledEndAt: {
      type: Date,
      required: [true, 'Scheduled end time is required'],
    },
    actualStartAt: Date,   // when first participant joined
    actualEndAt: Date,     // when the session ended
    // Participants (user + interviewer)
    participants: {
      type: [participantSchema],
      default: [],
    },
    // Collaborative code editor snapshots
    codeSnapshots: {
      type: [codeSnapshotSchema],
      default: [],
    },
    // In-session chat log
    chatLog: {
      type: [chatMessageSchema],
      default: [],
    },
    // Session recording
    recording: recordingSchema,
    // Interviewer's technical evaluation
    technicalEvaluation: technicalEvaluationSchema,
    // Topics / questions covered during the session
    topicsCovered: [{ type: String, trim: true }],
    // Problems attempted (e.g. LeetCode-style references)
    problemsAttempted: [
      {
        title: { type: String, trim: true, maxlength: 200 },
        difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
        solved: { type: Boolean, default: false },
        timeSpentMinutes: { type: Number, min: 0 },
        _id: false,
      },
    ],
    // Auto-detected or interviewer-set language used during coding
    primaryLanguage: { type: String, trim: true },
    // Abort details (if session ended unexpectedly)
    abortReason: { type: String, trim: true, maxlength: 500 },
    abortedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Indicates if a feedback reminder was sent post-session
    feedbackReminderSent: { type: Boolean, default: false },
    // Indicates whether the review has been created from this session
    reviewSubmitted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Note: booking already gets a unique index from unique:true on the field definition.
//       roomId already gets a unique sparse index from unique:true + sparse:true.
interviewSessionSchema.index({ user: 1, scheduledStartAt: -1 });          // user session history
interviewSessionSchema.index({ interviewer: 1, scheduledStartAt: -1 });   // interviewer calendar
interviewSessionSchema.index({ status: 1, scheduledStartAt: 1 });         // cron: upcoming + in-progress
interviewSessionSchema.index({ status: 1 });                              // admin dashboard
// Compound for dashboard: active sessions per interviewer
interviewSessionSchema.index({ interviewer: 1, status: 1 });
// Post-session jobs (feedback reminder, review prompt)
interviewSessionSchema.index(
  { status: 1, feedbackReminderSent: 1, actualEndAt: 1 },
  { name: 'post_session_jobs' }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
interviewSessionSchema.virtual('actualDurationMinutes').get(function () {
  if (!this.actualStartAt || !this.actualEndAt) return null;
  return Math.round((this.actualEndAt - this.actualStartAt) / (1000 * 60));
});

interviewSessionSchema.virtual('scheduledDurationMinutes').get(function () {
  if (!this.scheduledStartAt || !this.scheduledEndAt) return null;
  return Math.round((this.scheduledEndAt - this.scheduledStartAt) / (1000 * 60));
});

interviewSessionSchema.virtual('isLive').get(function () {
  return this.status === 'in-progress';
});

interviewSessionSchema.virtual('userParticipant').get(function () {
  return this.participants.find((p) => p.role === 'user') || null;
});

interviewSessionSchema.virtual('interviewerParticipant').get(function () {
  return this.participants.find((p) => p.role === 'interviewer') || null;
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
interviewSessionSchema.methods.start = function () {
  if (!['scheduled', 'waiting'].includes(this.status)) {
    throw new Error(`Cannot start session with status: ${this.status}`);
  }
  this.status = 'in-progress';
  this.actualStartAt = new Date();
  return this.save();
};

interviewSessionSchema.methods.end = function () {
  if (this.status !== 'in-progress') {
    throw new Error('Session is not in-progress');
  }
  this.status = 'ended';
  this.actualEndAt = new Date();
  return this.save();
};

interviewSessionSchema.methods.abort = function (userId, reason) {
  this.status = 'aborted';
  this.actualEndAt = new Date();
  this.abortedBy = userId;
  this.abortReason = reason;
  return this.save();
};

interviewSessionSchema.methods.recordJoin = function (userId, role) {
  const participant = this.participants.find(
    (p) => p.user.toString() === userId.toString()
  );
  if (participant) {
    // Re-join: update joinedAt only if they had left
    if (participant.leftAt) {
      participant.joinedAt = new Date();
      participant.leftAt = undefined;
    }
  } else {
    this.participants.push({ user: userId, role, joinedAt: new Date() });
  }
  if (this.status === 'scheduled' || this.status === 'waiting') {
    this.status = 'waiting';
  }
  return this.save();
};

interviewSessionSchema.methods.recordLeave = function (userId) {
  const participant = this.participants.find(
    (p) => p.user.toString() === userId.toString()
  );
  if (participant) {
    participant.leftAt = new Date();
    // Mark as present if they stayed for at least 70% of scheduled duration
    const scheduledMs = this.scheduledEndAt - this.scheduledStartAt;
    const stayMs = participant.leftAt - (participant.joinedAt || this.actualStartAt || this.scheduledStartAt);
    participant.wasPresent = stayMs / scheduledMs >= 0.7;
  }
  return this.save();
};

interviewSessionSchema.methods.addCodeSnapshot = function (language, code, savedBy, label = '') {
  this.codeSnapshots.push({ language, code, savedBy, label, savedAt: new Date() });
  return this.save();
};

interviewSessionSchema.methods.addChatMessage = function (sender, message, type = 'text') {
  this.chatLog.push({ sender, message, type, sentAt: new Date() });
  return this.save();
};

interviewSessionSchema.methods.submitEvaluation = function (evaluationData) {
  this.technicalEvaluation = { ...evaluationData, evaluatedAt: new Date() };
  return this.save();
};

interviewSessionSchema.methods.markFeedbackReminderSent = function () {
  this.feedbackReminderSent = true;
  return this.save();
};

interviewSessionSchema.methods.markReviewSubmitted = function () {
  this.reviewSubmitted = true;
  return this.save();
};

// ─── Output Sanitisation ──────────────────────────────────────────────────────
interviewSessionSchema.methods.toJSON = function () {
  const session = this.toObject();
  // Strip sensitive recording key
  if (session.recording) delete session.recording.key;
  delete session.__v;
  return session;
};

const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);

module.exports = InterviewSession;

// Made with Bob
