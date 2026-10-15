# School Database Design

## Tables

- **Students:** Stores each student's ID, name and email address. Each student has a unique ID and email.
- **Courses:** Stores each course's ID and name. Each course has a unique ID.
- **Enrolments:** Connects students to courses and stores the grade achieved for each enrolment. Foreign keys reference the students and courses tables.

## Relationships

The relationship between students and enrolments is one-to-many because one student can enrol in several courses, while each enrolment belongs to one student.

The relationship between courses and enrolments is one-to-many because one course can have several student enrolments, while each enrolment refers to one course.

Students and courses have a many-to-many relationship: a student can take multiple courses, and a course can have multiple students. The enrolments table connects these two tables and stores information about each enrolment, including the grade. A UNIQUE constraint on `student_id` and `course_id` prevents duplicate enrolments.

## Index

I would add an index on `enrolments(course_id)` to improve queries that find students on a particular course and calculate enrolment counts. Although SQLite automatically creates indexes for primary keys and UNIQUE constraints, this additional index can improve queries filtering or joining on the course ID.

## SQL or NoSQL?

I would choose a relational SQL database for this school system. Students, courses and enrolments have clear relationships, and enrolments must reference valid students and courses. SQL supports foreign keys, unique constraints, joins and grouping, helping maintain data accuracy and consistency. SQLite is suitable for this assignment because it is lightweight and supports these relational database features without requiring a separate database server.