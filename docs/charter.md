# Waterloo Schedule & Commute Optimization App — Project Charter

## Project title
Waterloo Schedule & Commute Optimization App

## Project overview
Develop a mobile application that intelligently integrates University of Waterloo students’ class schedules with real-time commute optimization. The app will automate the process of importing course timetables, determining the most efficient travel routes between buildings, and sending timely notifications on when to leave for each class. By combining academic scheduling with location-based intelligence, the app acts as a personalized assistant that ensures punctuality and reduces daily stress.

## Vision
Provide Waterloo students with a seamless, automated tool that merges schedule management and travel planning into a single platform. The app will intelligently adapt to each student’s daily routine, analyzing course locations and commute times to optimize punctuality and efficiency across campus. The long-term vision is to expand beyond Waterloo, enabling integration with other university schedule systems and transportation APIs.

## Goals and objectives
- Implement automatic schedule import through copy-paste parsing from Quest or UW Flow formats.  
- Build a reliable schedule parser that extracts course name, section, start/end times, and location.  
- Integrate mapping APIs (Google Maps, Mapbox, or OpenStreetMap) for route generation and travel-time estimation.  
- Enable route optimization for walking, biking, and transit modes (GRT/UW Shuttle).  
- Provide “When to Leave” notifications based on travel time, class start time, and user preferences.  
- Allow toggling of individual courses for the day/week with automatic route recalculation.  
- Maintain an intuitive, minimal UI suitable for daily use on mobile devices.  

## Scope
**In scope (MVP):**
- Schedule import via text parser.  
- Geocoding and routing API integration.  
- Basic UI showing timetable and optimized commute timeline.  
- Notifications for upcoming classes and departure times.  
- Support for walking and biking routes between class locations.  

**Out of scope (initial iteration):**
- Full integration with Quest API or official UW data feeds.  
- Real-time transit tracking (to be added in later versions).  
- Social or collaborative features (e.g., syncing with friends).  
- Authentication system or user profile storage (initial version may store locally).  

## Stakeholders
- Project development team (students/developers).  
- University of Waterloo student community (end users).  
- Course instructors / TA staff indirectly benefiting from improved punctuality.  
- Potential future partners (UW Flow, GRT, or UW Shuttle).  

## Success criteria
- Successful parsing and population of a full student schedule from Quest/UW Flow data.  
- Accurate commute time calculations and route suggestions between consecutive classes.  
- Reliable push notifications for “When to Leave” alerts.  
- Usable mobile interface that displays schedule, map routes, and commute plans.  
- MVP tested successfully by at least 3–5 Waterloo students under real schedule conditions.  

## Timeline & milestones (suggested)
- **Week 1:** Research schedule formats and design data schema; prototype parser.  
- **Week 2:** Integrate mapping API and implement route calculation logic.  
- **Week 3:** Build mobile UI (React Native or Flutter) with schedule and map views.  
- **Week 4:** Add “When to Leave” notifications and basic settings toggles.  
- **Week 5:** Internal testing and documentation of MVP.  

## Constraints & assumptions
- Quest/UW Flow data will not have an official API; parsing will rely on consistent formatting of exported or copied schedules.  
- Mapping and routing APIs may require API keys with limited free-tier quotas.  
- Commute estimates assume stable weather and average walking/biking speeds.  
- The MVP focuses on on-campus or near-campus navigation only.  

## Risks
- Parsing errors due to inconsistent or changing Quest schedule formats.  
- API usage limits or costs from routing/map providers.  
- GPS inaccuracies or user location permission issues.  
- Delays in integrating reliable push notifications across iOS and Android.  

## Deliverables
- Fully functional MVP mobile app with schedule import and commute optimization.  
- API integration module for route calculation and geocoding.  
- Local storage or lightweight database for user schedules.  
- Documentation including setup instructions, architecture overview, and user guide.  
- Presentation/demo and project report summarizing design, implementation, and outcomes.  

