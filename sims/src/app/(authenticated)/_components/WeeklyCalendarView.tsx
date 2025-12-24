"use client";

import React, { useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { EventInput, EventContentArg } from "@fullcalendar/core";

type ScheduleSlot = {
  day: string;
  startTime: string;
  endTime: string;
  room: string;
};

type CourseSchedule = {
  enrollmentId: string;
  enrollmentStatus: string;
  courseCode: string;
  courseTitle: string;
  scheduleSlots: ScheduleSlot[];
  room: string;
  instructor: string;
};

type WeeklyCalendarViewProps = {
  courses: CourseSchedule[];
};

// Day mapping: Mon, Tue, Wed, Thu, Fri
const DAY_INDEX_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
};

// Use same calendar event colors as existing Calendar component
const calendarsEvents = {
  Danger: "danger",
  Success: "success",
  Primary: "primary",
  Warning: "warning",
};

const CALENDAR_COLORS = Object.keys(calendarsEvents);

// Convert schedule slots to FullCalendar events
function convertToCalendarEvents(courses: CourseSchedule[]): EventInput[] {
  const events: EventInput[] = [];
  const today = new Date();
  
  // Get Monday of current week
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(today.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  courses.forEach((course, courseIndex) => {
    const colorKey = CALENDAR_COLORS[courseIndex % CALENDAR_COLORS.length];
    
    course.scheduleSlots.forEach((slot) => {
      const dayOffset = DAY_INDEX_MAP[slot.day];
      if (dayOffset === undefined) return; // Skip if day is not Mon-Fri

      // Create date for this day of the week
      const eventDate = new Date(monday);
      eventDate.setDate(monday.getDate() + dayOffset - 1);

      // Parse time strings (HH:MM format)
      const [startHour, startMin] = slot.startTime.split(":").map(Number);
      const [endHour, endMin] = slot.endTime.split(":").map(Number);

      // Create start and end datetime
      const start = new Date(eventDate);
      start.setHours(startHour, startMin, 0, 0);
      
      const end = new Date(eventDate);
      end.setHours(endHour, endMin, 0, 0);

      events.push({
        id: `${course.enrollmentId}-${slot.day}-${slot.startTime}`,
        title: `${course.courseCode} - ${slot.room}`,
        start: start.toISOString(),
        end: end.toISOString(),
        extendedProps: {
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          room: slot.room,
          instructor: course.instructor,
          enrollmentStatus: course.enrollmentStatus,
          calendar: colorKey,
        },
      });
    });
  });

  return events;
}

// Reuse the same renderEventContent pattern from existing Calendar component
const renderEventContent = (eventInfo: EventContentArg) => {
  const props = eventInfo.event.extendedProps;
  const colorClass = `fc-bg-${eventInfo.event.extendedProps.calendar.toLowerCase()}`;
  return (
    <div
      className={`event-fc-color fc-event-main flex flex-col ${colorClass} rounded-sm p-1`}
    >
      <div className="fc-daygrid-event-dot"></div>
      <div className="fc-event-time text-gray-700 dark:text-gray-300 text-xs font-medium">
        {eventInfo.timeText}
      </div>
      <div className="fc-event-title text-gray-700 dark:text-gray-300 text-xs">
        {props.courseCode} - {props.room}
      </div>
    </div>
  );
};

export default function WeeklyCalendarView({ courses }: WeeklyCalendarViewProps) {
  const events = useMemo(() => convertToCalendarEvents(courses), [courses]);

  return (
    <div className="weekly-schedule-calendar custom-calendar">
      <FullCalendar
        plugins={[timeGridPlugin]}
        initialView="timeGridWeek"
        headerToolbar={false}
        weekends={false} // Hide weekends (Sat-Sun)
        allDaySlot={false}
        slotMinTime="09:00:00"
        slotMaxTime="18:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        height="auto"
        events={events}
        eventContent={renderEventContent}
        eventDisplay="block"
        nowIndicator={true}
        dayHeaderFormat={{ weekday: "short" }}
        slotLabelFormat={{
          hour: "numeric",
          minute: "2-digit",
          meridiem: "short",
        }}
        eventTimeFormat={{
          hour: "numeric",
          minute: "2-digit",
          meridiem: "short",
        }}
      />
    </div>
  );
}

