import React from 'react';
import { ScheduleEvent, DAYS, DEFAULT_TIME_SLOTS } from '@/types/schedule';
import { cn } from '@/lib/utils';

interface ScheduleGridProps {
  events: ScheduleEvent[];
  viewMode: 'class' | 'teacher';
  onSlotClick: (dayIndex: number, startTime: string, endTime: string) => void;
  onEventClick: (event: ScheduleEvent) => void;
}

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  events,
  viewMode,
  onSlotClick,
  onEventClick,
}) => {
  const gridStartTime = timeToMinutes(DEFAULT_TIME_SLOTS[0].start);
  const gridEndTime = timeToMinutes(DEFAULT_TIME_SLOTS[DEFAULT_TIME_SLOTS.length - 1].end);
  const totalMinutes = gridEndTime - gridStartTime;

  const getEventPosition = (event: ScheduleEvent) => {
    const startMinutes = timeToMinutes(event.startTime) - gridStartTime;
    const endMinutes = timeToMinutes(event.endTime) - gridStartTime;
    const top = (startMinutes / totalMinutes) * 100;
    const height = ((endMinutes - startMinutes) / totalMinutes) * 100;
    return { top: `${top}%`, height: `${height}%` };
  };

  const getEventsForDayAndTime = (dayIndex: number) => {
    return events.filter((e) => e.dayIndex === dayIndex);
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header Row */}
      <div className="grid grid-cols-[80px_repeat(6,1fr)] border-b border-border bg-muted/50">
        <div className="p-3 text-center text-sm font-medium text-muted-foreground">
          Heures
        </div>
        {DAYS.map((day) => (
          <div
            key={day.index}
            className="p-3 text-center text-sm font-semibold text-foreground border-l border-border"
          >
            <span className="hidden sm:inline">{day.name}</span>
            <span className="sm:hidden">{day.short}</span>
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className="grid grid-cols-[80px_repeat(6,1fr)]">
        {/* Time Column */}
        <div className="border-r border-border">
          {DEFAULT_TIME_SLOTS.map((slot, index) => (
            <div
              key={slot.start}
              className={cn(
                "h-16 flex items-start justify-center pt-1 text-xs text-muted-foreground",
                index !== 0 && "border-t border-border"
              )}
            >
              {slot.start}
            </div>
          ))}
        </div>

        {/* Day Columns */}
        {DAYS.map((day) => {
          const dayEvents = getEventsForDayAndTime(day.index);
          
          return (
            <div
              key={day.index}
              className="relative border-l border-border"
              style={{ minHeight: `${DEFAULT_TIME_SLOTS.length * 64}px` }}
            >
              {/* Slot backgrounds for clicking */}
              {DEFAULT_TIME_SLOTS.map((slot, index) => (
                <div
                  key={slot.start}
                  className={cn(
                    "h-16 cursor-pointer hover:bg-primary/5 transition-colors",
                    index !== 0 && "border-t border-border/50"
                  )}
                  onClick={() => onSlotClick(day.index, slot.start, slot.end)}
                />
              ))}

              {/* Event blocks */}
              {dayEvents.map((event) => {
                const position = getEventPosition(event);
                return (
                  <div
                    key={event.id}
                    className="absolute left-1 right-1 rounded-lg p-2 cursor-pointer hover:opacity-90 transition-opacity overflow-hidden shadow-sm"
                    style={{
                      top: position.top,
                      height: position.height,
                      backgroundColor: event.color,
                      minHeight: '48px',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    <div className="text-white text-xs font-semibold truncate">
                      {viewMode === 'class' ? event.subjectName : event.className}
                    </div>
                    <div className="text-white/90 text-xs truncate">
                      {viewMode === 'class' 
                        ? (event.teacherName || 'Non assigné')
                        : event.groupName
                      }
                    </div>
                    <div className="text-white/75 text-xs">
                      {event.startTime} - {event.endTime}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
