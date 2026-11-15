ALTER TABLE "CalendarEntry" ADD COLUMN "registrationStatus" TEXT;
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_registration_status"
CHECK ("registrationStatus" IN ('PENDING', 'CONFIRMED', 'REJECTED'));
