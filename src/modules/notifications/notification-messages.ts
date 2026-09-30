export interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  data?: Record<string, string>;
  recipientId: string;
}

/**
 * Centralized notification message generator.
 * Ensures consistent strings and payloads across the application.
 */
export const NotificationMessages = {
  // ─── P1: CORE NOTIFICATIONS ──────────────────────────────────────────

  /**
   * P1: Seeker applied for a job -> Company that posted the job
   */
  seekerApplied(
    jobTitle: string,
    seekerName: string,
    applicationId: string,
    jobId: string,
    recipientId: string,
  ): NotificationPayload {
    const candidate = seekerName?.trim() || 'A candidate';
    return {
      type: 'application_update',
      title: 'New Job Application',
      message: `${candidate} applied for ${jobTitle}`,
      data: {
        applicationId,
        jobId,
        action: 'applied',
        recipientId,
      },
      recipientId,
    };
  },

  /**
   * P1: Application shortlisted/accepted/status updated -> Job seeker who applied
   */
  applicationStatusUpdated(
    jobTitle: string,
    status: string,
    applicationId: string,
    jobId: string,
    recipientId: string,
  ): NotificationPayload {
    const formattedStatus =
      status.charAt(0).toUpperCase() + status.slice(1);
    return {
      type: 'application_update',
      title: `Application ${formattedStatus}`,
      message: `Your application for ${jobTitle} has been ${status}`,
      data: {
        applicationId,
        jobId,
        status,
        recipientId,
      },
      recipientId,
    };
  },

  /**
   * P1: Interview invite / chat message -> Other participant
   */
  newMessage(
    senderName: string,
    text: string,
    conversationId: string,
    recipientId: string,
  ): NotificationPayload {
    const preview =
      text.length > 80 ? text.substring(0, 77) + '...' : text;
    const title = senderName?.trim()
      ? `New message from ${senderName}`
      : 'New message received';
    return {
      type: 'newMessage',
      title,
      message: preview,
      data: {
        conversationId,
        recipientId,
      },
      recipientId,
    };
  },

  // ─── P3: BATCH / INFORMATIONAL NOTIFICATIONS ─────────────────────────

  /**
   * P3: New job posted -> Seekers matching required skills/location
   */
  newJobPosted(
    jobTitle: string,
    location: string,
    jobId: string,
    recipientId: string,
  ): NotificationPayload {
    return {
      type: 'new_job',
      title: `New Job: ${jobTitle}`,
      message: `A new job "${jobTitle}" matching your profile is available in ${location}`,
      data: {
        jobId,
        location,
        recipientId,
      },
      recipientId,
    };
  },

  /**
   * P3: Assigned to project -> Contractor
   */
  projectAssignment(
    projectName: string,
    projectId: string,
    recipientId: string,
  ): NotificationPayload {
    return {
      type: 'project_assignment',
      title: 'Project Assignment',
      message: `You have been assigned to project: ${projectName}`,
      data: {
        projectId,
        recipientId,
      },
      recipientId,
    };
  },

  /**
   * P3: Assigned to site -> Site engineer
   */
  siteAssignment(
    siteName: string,
    siteId: string,
    recipientId: string,
  ): NotificationPayload {
    return {
      type: 'site_assignment',
      title: 'Site Assignment',
      message: `You have been assigned to site: ${siteName}`,
      data: {
        siteId,
        recipientId,
      },
      recipientId,
    };
  },

  /**
   * P3: Daily attendance summary -> Contractor (6 PM batch)
   */
  dailyAttendanceSummary(
    siteName: string,
    presentCount: number,
    totalCount: number,
    date: string,
    recipientId: string,
  ): NotificationPayload {
    return {
      type: 'attendance_event',
      title: 'Daily Attendance Summary',
      message: `Attendance summary for ${siteName} on ${date}: ${presentCount}/${totalCount} workers present.`,
      data: {
        siteName,
        date,
        presentCount: String(presentCount),
        totalCount: String(totalCount),
        recipientId,
      },
      recipientId,
    };
  },

  /**
   * P3: Daily report submitted -> Contractor / Admin
   */
  dailyReportSubmitted(
    siteName: string,
    date: string,
    reportId: string,
    recipientId: string,
  ): NotificationPayload {
    return {
      type: 'daily_report_submitted',
      title: 'Daily Report Submitted',
      message: `A daily report for ${siteName} was submitted for ${date}`,
      data: {
        reportId,
        siteName,
        date,
        recipientId,
      },
      recipientId,
    };
  },

  /**
   * P3: Project updated -> Everyone associated with that project
   */
  projectUpdate(
    projectName: string,
    summary: string,
    projectId: string,
    recipientId: string,
  ): NotificationPayload {
    return {
      type: 'project_update',
      title: `Project Updated: ${projectName}`,
      message: summary
        ? `${projectName}: ${summary}`
        : `Project ${projectName} was recently updated`,
      data: {
        projectId,
        recipientId,
      },
      recipientId,
    };
  },

  /**
   * P3: Admin announcement -> Broadcast or selected userIds
   */
  adminAnnouncement(
    title: string,
    message: string,
    recipientId: string,
  ): NotificationPayload {
    return {
      type: 'admin_announcement',
      title,
      message,
      data: {
        event: 'admin_announcement',
        recipientId,
      },
      recipientId,
    };
  },
};
