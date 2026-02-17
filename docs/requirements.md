# Requirements: HHU (Happy Hour University)

## 1. Goal
A localized, ephemeral matching platform for UBC students to find drinking buddies on weekends.

## 2. User Stories & Features
- **UBC Auth**: Users must sign up with a @student.ubc.ca email.
- **Profile Setup**: Mandatory registration of Name, Gender (M/F/NB), and Faculty.
- **Course Selection (Queueing)**: 
    - Users select a "Course" (e.g., BEER101, TEQUILA911).
    - Joining a course puts the user into a matchmaking queue.
- **Matching**:
    - Users are matched with others in the same course and same gender preference.
    - Matching must be instant and prevent double-matching.
- **Ephemeral Chat**:
    - A dedicated chat room is created upon matching.
    - Chat is text-only and highly transient.

## 3. Business Rules
- **The "Morning After" Wipe**: All matches, messages, and queues are permanently deleted every day at 4:00 AM PST.
- **Grading**: Users can "grade" their match (A+ to F) the following morning.