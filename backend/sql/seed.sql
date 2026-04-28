USE edutech;

INSERT INTO users (name, email, password, role)
VALUES
  ('Admin', 'admin@edutech.com', 'admin123', 'admin'),
  ('User', '123@gmail.com', '12345678', 'user')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO courses (name, lecturer_name, message, icon)
VALUES
  ('Web Technology', 'Dr. Aisyah', 'Start by today!', 'image1.png'),
  ('Public speaking', 'Mr. Daniel', 'Incredible!', 'image2.png'),
  ('Presentation skill', 'Ms. Farah', 'Almost there!', 'image3.png'),
  ('Calculus', 'Dr. Kumar', 'Keep it up!', 'image4.png');

INSERT INTO enrollments (user_id, course_id)
SELECT u.id, c.id
FROM users u
CROSS JOIN courses c
WHERE u.email = '123@gmail.com'
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

INSERT INTO books (title, price, country, area, type, category, image, stock)
VALUES
  ('Web Development with HTML, CSS, JS', 39.00, 'Malaysia', 'Klang Valley', 'Book', 'Web Dev', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80', 30),
  ('Public Speaking for Students', 32.00, 'Malaysia', 'Johor', 'Workbook', 'Communication', 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=800&q=80', 22),
  ('SQL Crash Course', 45.00, 'Singapore', 'Central', 'E-Book', 'Database', 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=800&q=80', 40);

INSERT INTO forum_posts (title, author_name, avatar, content, tag, pinned, likes, replies, image, last_activity_text)
VALUES
  ('How to use React', 'Jason', 'J', 'Any practical path for state management and props?', 'Web', TRUE, 24, 5, 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=80', '10 mins ago'),
  ('Best resources for learning Python?', 'Timothy', 'T', 'Looking for project-based resources.', 'Programming', FALSE, 13, 3, 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=1000&q=80', '22 mins ago');
