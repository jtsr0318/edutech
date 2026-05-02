const state = {
  isLoggedIn: false,
  page: "landing",
  authToken: "",
  authRole: "student",
  currentUser: null,
  authMode: "login",
  authDraft: { name: "", email: "", password: "", confirmPassword: "" },
  mobileNavOpen: false,
  postLoginPage: "home",
  adminPage: "dashboard",
  adminLoading: false,
  adminError: "",
  adminStats: null,
  adminCourses: [],
  adminBooks: [],
  adminForumPosts: [],
  adminUsers: [],
  adminUserForm: { id: "", name: "", email: "", role: "user" },
  adminChatUsers: [],
  adminSelectedChatUserId: "",
  adminChatMessages: [],
  adminChatDraft: "",
  adminCourseForm: { id: "", name: "", lecturerName: "" },
  adminStreamCourseId: "",
  adminEnrollments: [],
  adminMaterialForm: { courseId: "", name: "", commentText: "", publishAt: "" },
  adminAnnouncementForm: { courseId: "", title: "", text: "", publishAt: "" },
  adminAssignmentForm: {
    courseId: "",
    title: "",
    type: "short",
    dueAt: "",
    publishAt: "",
    rubricTemplate: "",
    timerSeconds: 60,
    quizQuestion: "",
    quizOptionA: "",
    quizOptionB: "",
    quizOptionC: "",
    quizOptionD: "",
    quizAnswerKey: "A",
    quizExplanation: "",
    commentText: "",
  },
  adminCommentForm: { courseId: "", contentType: "announcement", contentId: "", text: "" },
  adminStudioTab: "materials",
  adminBookSearch: "",
  adminBookForm: { id: "", title: "", price: 0, country: "", area: "", type: "", category: "", description: "", image: "", stock: 0 },
  supportLoading: false,
  supportError: "",
  supportMessages: [],
  supportDraft: "",
  chatState: {
    isOpen: false,
    messages: [],
    unreadCount: 0,
  },
  userScoped: {
    progressByCourse: {},
    savedAnnouncements: {},
    cart: {},
    orders: [],
  },
  courseProgressById: {},
  courseProgressLoading: false,
  selectedCourse: "Web Technology",
  courseTab: "Announcements",
  dropdownOpen: false,
  materialOpen: {},
  assignmentOpen: {},
  announcementCommentOpen: {},
  announcementSaved: {},
  announcementCommentDrafts: {},
  announcementComments: {},
  showAllNotifications: false,
  forumSearch: "",
  forumSort: "latest",
  forumTag: "All",
  forumComposerOpen: false,
  forumDraft: "",
  forumReplyTo: null,
  forumReplyDraft: "",
  courseFilter: "all",
  courseSearch: "",
  courseSort: "progress",
  bookFilters: {
    country: "All",
    area: "All",
    type: "All",
    minPrice: 0,
    maxPrice: 200,
  },
  bookSearch: "",
  bookSort: "featured",
  bookTag: "Featured",
  cart: {},
  previewBook: null,
  notificationsOpen: false,
  toasts: [],
  forumViewingPost: null,
  selectedMcqOption: {},
  quizDraftAnswers: {},
  quizStartAtByAssignment: {},
  quizTimerNow: Date.now(),
  quizHistoryByAssignment: {},
  commentDrafts: {},
  commentsByKey: {},
  shortAnswerDrafts: {},
  assignmentSubmissions: {},
  materialSeed: 0,
  profileDraft: {
    name: "User",
    email: "123@gmail.com",
    bio: "I am passionate about learning new technologies.",
  },
  settingsDraft: {
    language: "English",
    theme: "Light",
    notificationPref: "All notifications",
  },
  paymentDraft: {
    fullName: "",
    email: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  },
};

const data = {
  user: { name: "User", email: "user@edutech.com" },
  lecturer: { name: "Lecturer", avatar: "👩‍🏫" },
  courses: [],
  notifications: [],
  announcements: [],
  materials: [],
  assignments: [],
  forum: [],
  books: [],
  contentComments: [],
};

function resolveDefaultApiBase() {
  if (typeof window === "undefined" || typeof window.location === "undefined") {
    return "http://localhost:4000/api";
  }
  try {
    const h = window.location.hostname || "";
    if (h === "localhost" || h === "127.0.0.1") {
      return "http://localhost:4000/api";
    }
    const injected = String(window.EDUTECH_API_BASE_URL || "").trim();
    if (injected) return injected;
    // For any deployed domain, default to same-origin API path.
    return `${window.location.origin}/api`;
  } catch (_) {}
  return "http://localhost:4000/api";
}

const API_BASE_URL =
  localStorage.getItem("edutech_api_base") ||
  String(window.EDUTECH_API_BASE_URL || "").trim() ||
  resolveDefaultApiBase();

/** Use for <a href> / <img src> when the API stores paths like /api/uploads/... — must hit the API host, not the Vercel static origin. */
function resolvePublicApiUrl(path) {
  const p = String(path ?? "").trim();
  if (p === "#") return "#";
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/api/")) {
    try {
      const origin = new URL(API_BASE_URL).origin;
      return `${origin}${p}`;
    } catch {
      return p;
    }
  }
  return p;
}

let forumSearchTerm = state.forumSearch;
let courseSearchTerm = state.courseSearch;
let filterState = {
  country: state.bookFilters.country === "All" ? "" : state.bookFilters.country,
  area: state.bookFilters.area === "All" ? "" : state.bookFilters.area,
  type: state.bookFilters.type === "All" ? "" : state.bookFilters.type,
};
let chatPollingTimer = null;
let quizTimerTicker = null;
let globalOutsideClickBound = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function apiRequest(path, options = {}) {
  const hasFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(hasFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };
  if (state.authToken) {
    headers.Authorization = `Bearer ${state.authToken}`;
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? (hasFormData ? options.body : JSON.stringify(options.body)) : undefined,
  });
  let payload = {};
  try {
    payload = await res.json();
  } catch {
    payload = {};
  }
  if (!res.ok) {
    throw new Error(payload.message || `API request failed: ${res.status}`);
  }
  return payload;
}

function persistSession() {
  localStorage.setItem(
    "edutech_session",
    JSON.stringify({
      token: state.authToken || "",
      role: state.authRole || "student",
      user: state.currentUser || null,
    })
  );
}

function persistAdminStudioDrafts() {
  try {
    localStorage.setItem(
      "edutech_admin_studio_drafts",
      JSON.stringify({
        material: state.adminMaterialForm,
        announcement: state.adminAnnouncementForm,
        assignment: state.adminAssignmentForm,
      })
    );
  } catch {}
}

function loadAdminStudioDrafts() {
  try {
    const raw = localStorage.getItem("edutech_admin_studio_drafts");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.material) state.adminMaterialForm = { ...state.adminMaterialForm, ...parsed.material };
    if (parsed?.announcement) state.adminAnnouncementForm = { ...state.adminAnnouncementForm, ...parsed.announcement };
    if (parsed?.assignment) state.adminAssignmentForm = { ...state.adminAssignmentForm, ...parsed.assignment };
  } catch {}
}

function clearSession() {
  localStorage.removeItem("edutech_session");
}

function loadSessionFromStorage() {
  try {
    const raw = localStorage.getItem("edutech_session");
    if (!raw) return;
    const session = JSON.parse(raw);
    if (!session?.token) return;
    state.authToken = session.token;
    state.authRole = session.role || "student";
    state.currentUser = session.user || null;
    state.isLoggedIn = true;
    state.page = state.authRole === "admin" ? "admin" : "landing";
  } catch {}
}

function mockApi(response, delay = 800, shouldFail = false) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) reject(new Error("Mock API error"));
      else resolve(response);
    }, delay);
  });
}

async function loginUser(payload) {
  return apiRequest("/auth/login", { method: "POST", body: payload });
}

async function registerUser(payload) {
  return apiRequest("/auth/register", { method: "POST", body: payload });
}

async function adminLoginUser(payload) {
  return apiRequest("/auth/admin/login", { method: "POST", body: payload });
}

async function checkoutOrder(payload) {
  return apiRequest("/orders/checkout", { method: "POST", body: payload });
}

async function saveAnnouncementApi(announcementId) {
  return apiRequest(`/announcements/${encodeURIComponent(announcementId)}/save`, { method: "POST" });
}

async function unsaveAnnouncementApi(announcementId) {
  return apiRequest(`/announcements/${encodeURIComponent(announcementId)}/save`, { method: "DELETE" });
}

async function fetchCourses() {
  return apiRequest("/courses");
}

async function fetchAssignments() {
  return apiRequest("/assignments");
}

async function fetchAnnouncements() {
  return apiRequest("/announcements");
}

async function fetchMaterials() {
  return apiRequest("/materials");
}
async function fetchComments() {
  return apiRequest("/comments");
}

async function submitAssignmentToApi(assignmentId, payload) {
  return apiRequest(`/assignments/${assignmentId}/submit`, { method: "POST", body: payload });
}

async function submitQuizToApi(assignmentId, payload) {
  return apiRequest(`/assignments/${assignmentId}/quiz/submit`, { method: "POST", body: payload });
}

async function enrollCourse(courseId) {
  return apiRequest(`/courses/${courseId}/enroll`, { method: "POST" });
}

async function joinCourseByCodeApi(joinCode) {
  return apiRequest("/courses/join", { method: "POST", body: { joinCode } });
}

async function fetchForumPosts() {
  return apiRequest("/forum/posts");
}

async function createForumPost(payload) {
  return apiRequest("/forum/posts", { method: "POST", body: payload });
}

async function replyForumPost(postId, payload) {
  return apiRequest(`/forum/posts/${postId}/reply`, { method: "POST", body: payload });
}

async function fetchBooks() {
  return apiRequest("/books");
}

async function addCartItemApi(bookId, qty = 1) {
  return apiRequest("/cart/items", { method: "POST", body: { bookId, qty } });
}

async function updateCartItemApi(bookId, qty) {
  return apiRequest(`/cart/items/${encodeURIComponent(bookId)}`, { method: "PATCH", body: { qty } });
}

async function removeCartItemApi(bookId) {
  return apiRequest(`/cart/items/${encodeURIComponent(bookId)}`, { method: "DELETE" });
}

async function clearCartApi() {
  return apiRequest("/cart/items", { method: "DELETE" });
}

async function loadDataDrivenCollections() {
  const [coursesRes, assignmentsRes, announcementsRes, materialsRes, commentsRes, forumRes, booksRes] = await Promise.all([
    fetchCourses(),
    fetchAssignments(),
    fetchAnnouncements(),
    fetchMaterials(),
    fetchComments(),
    fetchForumPosts(),
    fetchBooks(),
  ]);
  data.courses = coursesRes.items || [];
  data.assignments = assignmentsRes.items || [];
  data.announcements = announcementsRes.items || [];
  data.materials = materialsRes.items || [];
  data.contentComments = commentsRes.items || [];
  data.forum = forumRes.items || [];
  data.books = booksRes.items || [];
  state.assignmentSubmissions = Object.fromEntries(
    (data.assignments || [])
      .filter((item) => item.submission)
      .map((item) => [item.id, item.submission])
  );
  state.quizHistoryByAssignment = Object.fromEntries(
    (data.assignments || [])
      .filter((item) => item.quizHistory)
      .map((item) => [item.id, item.quizHistory])
  );
}

async function fetchCourseProgress(courseId) {
  return apiRequest(`/course/${encodeURIComponent(courseId)}/progress`);
}

async function refreshCourseProgress() {
  const courses = data.courses || [];
  if (!courses.length) return;
  state.courseProgressLoading = true;
  try {
    const pairs = await Promise.all(
      courses.map(async (course) => {
        const id = course.id || course.name;
        const payload = await fetchCourseProgress(id);
        return [String(id), Number(payload.progress || 0)];
      })
    );
    state.courseProgressById = Object.fromEntries(pairs);
  } catch (err) {
    pushToast("error", err.message || "Failed to load course progress.");
  } finally {
    state.courseProgressLoading = false;
  }
}

function validateEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function pushToast(type, message, duration = 2800) {
  const toast = { id: `t${Date.now()}${Math.random()}`, type, message };
  state.toasts.push(toast);
  render();
  if (duration > 0) setTimeout(() => dismissToast(toast.id), duration);
}

function dismissToast(id) {
  state.toasts = state.toasts.filter((t) => t.id !== id);
  render();
}

function setPreLoginPage(page) {
  state.page = page;
  state.mobileNavOpen = false;
  render();
}

function setAuthMode(mode) {
  state.authMode = mode;
  render();
}

function updateAuthDraft(key, value) {
  if (!state.authDraft || typeof state.authDraft !== "object") {
    state.authDraft = { name: "", email: "", password: "", confirmPassword: "" };
  }
  state.authDraft[key] = value;
}

function togglePasswordVisibility(buttonEl, selector) {
  if (!buttonEl || !selector) return;
  const form = buttonEl.closest("form");
  const input = (form || document).querySelector(selector);
  if (!input) return;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  buttonEl.textContent = show ? "Hide" : "Show";
}

function setPostLoginPage(page) {
  if (page === "support") {
    page = "home";
  }
  state.postLoginPage = page;
  state.dropdownOpen = false;
  state.notificationsOpen = false;
  state.mobileNavOpen = false;
  if (page !== "forum") state.forumViewingPost = null;
  render();
  if (page === "courses") {
    refreshCourseProgress().then(() => render());
  }
}

function toggleMobileNav() {
  state.mobileNavOpen = !state.mobileNavOpen;
  render();
}

function setCourseTab(tab) {
  state.courseTab = tab;
  render();
}

async function setCourse(courseName) {
  state.selectedCourse = courseName;
  state.postLoginPage = "courseDetail";
  const course = data.courses.find((c) => c.name === courseName);
  if (course?.id && state.isLoggedIn) {
    try {
      await refreshCourseProgress();
    } catch (err) {
      pushToast("error", err.message || "Failed to refresh course progress.");
    }
  }
  render();
}

async function login(event) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    pushToast("error", "Please fill in email and password.");
    return;
  }
  if (!validateEmail(email)) {
    pushToast("error", "Invalid email format.");
    return;
  }

  const original = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Loading...";
  pushToast("loading", "Processing login...", 900);
  try {
    const res = await loginUser({ email, password });
    if (res.status === "success") {
      data.user = res.user || data.user;
      state.currentUser = res.user || null;
      state.authToken = res.token || "";
      state.authRole = "student";
      state.isLoggedIn = true;
      state.page = "landing";
      state.postLoginPage = "home";
      persistSession();
      await loadUserScopedData();
      await loadStudentChat();
      setupChatPolling();
      addNotification("Login", "Login successful.");
      pushToast("success", "Login successful.");
      render();
    } else {
      pushToast("error", "Invalid credentials.");
    }
  } catch (err) {
    pushToast("error", err?.message || "Login failed.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = original;
  }
}

async function register(event) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const confirmPassword = String(formData.get("confirmPassword") || "").trim();

  if (!name || !email || !password || !confirmPassword) {
    pushToast("error", "Please complete all register fields.");
    return;
  }
  if (!validateEmail(email)) {
    pushToast("error", "Invalid email format.");
    return;
  }
  if (password.length < 6) {
    pushToast("error", "Password must be at least 6 characters.");
    return;
  }
  if (password !== confirmPassword) {
    pushToast("error", "Password confirmation does not match.");
    return;
  }

  const original = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Loading...";
  pushToast("loading", "Creating account...", 900);
  try {
    const res = await registerUser({ name, email, password });
    if (res.status === "success") {
      data.user = res.user;
      state.currentUser = res.user || null;
      state.authToken = res.token || "";
      state.authRole = "student";
      state.isLoggedIn = true;
      state.page = "landing";
      state.postLoginPage = "home";
      persistSession();
      await loadUserScopedData();
      await loadStudentChat();
      setupChatPolling();
      addNotification("Registration", "Account created successfully.");
      pushToast("success", "Registration successful.");
      render();
    } else {
      pushToast("error", res.message || "Registration failed.");
    }
  } catch (err) {
    pushToast("error", err?.message || "Registration failed.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = original;
  }
}

async function adminLogin(event) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  if (!email || !password) {
    pushToast("error", "Please fill in admin email and password.");
    return;
  }
  if (!validateEmail(email)) {
    pushToast("error", "Invalid email format.");
    return;
  }
  const original = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Loading...";
  pushToast("loading", "Authenticating admin...", 900);
  try {
    const res = await adminLoginUser({ email, password });
    if (res.status === "success") {
      state.authToken = res.token || "";
      state.authRole = "admin";
      state.currentUser = res.user || { name: "Admin", email };
      state.isLoggedIn = true;
      state.page = "admin";
      state.adminPage = "dashboard";
      if (chatPollingTimer) {
        clearInterval(chatPollingTimer);
        chatPollingTimer = null;
      }
      persistSession();
      await refreshAdminPageData();
      pushToast("success", "Admin login successful.");
      render();
    } else {
      pushToast("error", res.message || "Admin login failed.");
    }
  } catch (err) {
    pushToast("error", err.message || "Admin login failed.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = original;
  }
}

function setAdminPage(page) {
  state.adminPage = page;
  refreshAdminPageData();
}

function updateAdminCourseForm(key, value) {
  state.adminCourseForm[key] = value;
}

function setAdminStudioTab(tab) {
  const next = String(tab || "materials");
  state.adminStudioTab = ["materials", "announcements", "assignments"].includes(next) ? next : "materials";
  render();
}

async function adminFetchEnrollments(courseId) {
  if (!courseId) {
    state.adminEnrollments = [];
    return;
  }
  const payload = await apiRequest(`/admin/courses/${encodeURIComponent(courseId)}/enrollments`);
  state.adminEnrollments = payload.items || [];
}

function setAdminStreamCourse(courseId) {
  const target = String(courseId || "");
  const normalized = String(state.adminStreamCourseId || "") === target ? "" : target;
  state.adminStreamCourseId = normalized;
  state.adminMaterialForm.courseId = normalized;
  state.adminAnnouncementForm.courseId = normalized;
  state.adminAssignmentForm.courseId = normalized;
  state.adminCommentForm.courseId = normalized;
  state.adminCommentForm.contentId = "";
  if (!normalized) {
    state.adminEnrollments = [];
  }
  render();
  if (normalized) {
    adminFetchEnrollments(normalized)
      .then(() => render())
      .catch((err) => {
        state.adminEnrollments = [];
        pushToast("error", err.message || "Failed to load enrollments.");
        render();
      });
  }
}

function editAdminCourse(courseId) {
  const course = state.adminCourses.find((item) => String(item.id) === String(courseId));
  if (!course) return;
  state.adminCourseForm = {
    id: course.id || "",
    name: course.name || "",
    lecturerName: course.lecturerName || "",
  };
  state.adminStreamCourseId = String(course.id || "");
  state.adminMaterialForm.courseId = String(course.id || "");
  state.adminAnnouncementForm.courseId = String(course.id || "");
  state.adminAssignmentForm.courseId = String(course.id || "");
  state.adminCommentForm.courseId = String(course.id || "");
  render();
  adminFetchEnrollments(String(course.id || ""))
    .then(() => render())
    .catch((err) => {
      state.adminEnrollments = [];
      pushToast("error", err.message || "Failed to load enrollments.");
      render();
    });
}

async function saveAdminCourse() {
  try {
    const payload = {
      name: state.adminCourseForm.name.trim(),
      lecturerName: String(state.adminCourseForm.lecturerName || "").trim(),
    };
    if (!payload.name) {
      pushToast("error", "Course name is required.");
      return;
    }
    if (!payload.lecturerName) {
      pushToast("error", "Course lecturer name is required.");
      return;
    }
    if (state.adminCourseForm.id) {
      await apiRequest(`/admin/courses/${state.adminCourseForm.id}`, { method: "PUT", body: payload });
      pushToast("success", "Course updated.");
    } else {
      await apiRequest("/admin/courses", { method: "POST", body: payload });
      pushToast("success", "Course created.");
    }
    state.adminCourseForm = { id: "", name: "", lecturerName: "" };
    await refreshAdminPageData();
  } catch (err) {
    pushToast("error", err.message || "Failed to save course.");
  }
}

function updateAdminMaterialForm(key, value) {
  state.adminMaterialForm[key] = value;
  persistAdminStudioDrafts();
}

function updateAdminAnnouncementForm(key, value) {
  state.adminAnnouncementForm[key] = value;
  persistAdminStudioDrafts();
}

function updateAdminAssignmentForm(key, value) {
  state.adminAssignmentForm[key] = value;
  persistAdminStudioDrafts();
  if (key === "type") {
    render();
  }
}
function updateAdminCommentForm(key, value) {
  state.adminCommentForm[key] = value;
  if (key === "courseId" || key === "contentType") {
    state.adminCommentForm.contentId = "";
  }
}

function getContentComments(contentType, contentId) {
  return (data.contentComments || []).filter(
    (c) => c.contentType === contentType && String(c.contentId) === String(contentId)
  );
}

function getAdminCommentTargetOptions() {
  const courseId = String(state.adminCommentForm.courseId || "");
  if (!courseId) return [];
  if (state.adminCommentForm.contentType === "announcement") {
    return (data.announcements || [])
      .filter((a) => String(a.courseId) === courseId)
      .map((a) => ({ id: a.id, label: a.title }));
  }
  if (state.adminCommentForm.contentType === "material") {
    return (data.materials || [])
      .filter((m) => String(m.courseId) === courseId)
      .map((m) => ({ id: m.id, label: m.name }));
  }
  return (data.assignments || [])
    .filter((a) => String(a.courseId) === courseId)
    .map((a) => ({ id: a.id, label: a.title }));
}

async function saveAdminMaterial() {
  try {
    const courseId = String(state.adminMaterialForm.courseId || "").trim();
    const fileInput = document.getElementById("admin-material-file");
    const selectedFile = fileInput?.files?.[0];
    const materialName = String(state.adminMaterialForm.name || "").trim();
    if (!courseId || !selectedFile) {
      pushToast("error", "Course and file are required.");
      return;
    }
    const formData = new FormData();
    formData.append("name", materialName || selectedFile.name);
    formData.append("file", selectedFile);
    formData.append("publishAt", String(state.adminMaterialForm.publishAt || "").trim());
    const uploadRes = await apiRequest(`/admin/courses/${courseId}/materials`, { method: "POST", body: formData });
    const inlineComment = String(state.adminMaterialForm.commentText || "").trim();
    if (inlineComment && uploadRes?.item?.id) {
      await apiRequest("/admin/comments", {
        method: "POST",
        body: {
          courseId,
          contentType: "material",
          contentId: String(uploadRes.item.id),
          text: inlineComment,
        },
      });
    }
    state.adminMaterialForm = { courseId: String(state.adminStreamCourseId || ""), name: "", commentText: "", publishAt: "" };
    persistAdminStudioDrafts();
    if (fileInput) fileInput.value = "";
    await loadDataDrivenCollections();
    pushToast("success", "Material uploaded.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to upload material.");
  }
}

async function saveAdminAnnouncement() {
  try {
    const courseId = String(state.adminAnnouncementForm.courseId || "").trim();
    const payload = {
      title: String(state.adminAnnouncementForm.title || "").trim(),
      text: String(state.adminAnnouncementForm.text || "").trim(),
      publishAt: String(state.adminAnnouncementForm.publishAt || "").trim(),
    };
    if (!courseId || !payload.title || !payload.text) {
      pushToast("error", "Course, title, and announcement text are required.");
      return;
    }
    await apiRequest(`/admin/courses/${courseId}/announcements`, { method: "POST", body: payload });
    state.adminAnnouncementForm = { courseId: String(state.adminStreamCourseId || ""), title: "", text: "", publishAt: "" };
    persistAdminStudioDrafts();
    await loadDataDrivenCollections();
    pushToast("success", "Announcement posted.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to post announcement.");
  }
}

async function saveAdminAssignment() {
  try {
    const courseId = String(state.adminAssignmentForm.courseId || "").trim();
    const payload = {
      title: String(state.adminAssignmentForm.title || "").trim(),
      type: String(state.adminAssignmentForm.type || "short").trim(),
      dueAt: String(state.adminAssignmentForm.dueAt || "").trim(),
      publishAt: String(state.adminAssignmentForm.publishAt || "").trim(),
      rubricTemplate: String(state.adminAssignmentForm.rubricTemplate || "").trim(),
      timerSeconds: Number(state.adminAssignmentForm.timerSeconds || 0),
    };
    if (payload.type === "mcq") {
      const q = String(state.adminAssignmentForm.quizQuestion || "").trim();
      const a = String(state.adminAssignmentForm.quizOptionA || "").trim();
      const b = String(state.adminAssignmentForm.quizOptionB || "").trim();
      const c = String(state.adminAssignmentForm.quizOptionC || "").trim();
      const d = String(state.adminAssignmentForm.quizOptionD || "").trim();
      const answerKey = String(state.adminAssignmentForm.quizAnswerKey || "A").trim().toUpperCase();
      const explanation = String(state.adminAssignmentForm.quizExplanation || "").trim();
      const answerMap = { A: a, B: b, C: c, D: d };
      const answer = answerMap[answerKey] || "";
      if (!q || !a || !b || !c || !d || !answer) {
        pushToast("error", "Please fill quiz question, all options, and select correct answer.");
        return;
      }
      payload.quizPayload = {
        questions: [{ id: "q1", question: q, options: [a, b, c, d], answer, explanation }],
      };
    }
    if (!courseId || !payload.title) {
      pushToast("error", "Course and assignment title are required.");
      return;
    }
    const fileInput = document.getElementById("admin-assignment-attachment");
    const file = fileInput && fileInput.files && fileInput.files[0];
    let createRes;
    if (file) {
      const fd = new FormData();
      fd.append("title", payload.title);
      fd.append("type", payload.type);
      fd.append("dueAt", payload.dueAt);
      fd.append("publishAt", payload.publishAt);
      fd.append("rubricTemplate", payload.rubricTemplate);
      fd.append("timerSeconds", String(payload.timerSeconds));
      if (payload.quizPayload) {
        fd.append("quizPayload", JSON.stringify(payload.quizPayload));
      }
      fd.append("attachment", file, file.name);
      createRes = await apiRequest(`/admin/courses/${courseId}/assignments`, { method: "POST", body: fd });
    } else {
      createRes = await apiRequest(`/admin/courses/${courseId}/assignments`, { method: "POST", body: payload });
    }
    if (fileInput) fileInput.value = "";
    const inlineComment = String(state.adminAssignmentForm.commentText || "").trim();
    if (inlineComment && createRes?.item?.id) {
      await apiRequest("/admin/comments", {
        method: "POST",
        body: {
          courseId,
          contentType: "assignment",
          contentId: String(createRes.item.id),
          text: inlineComment,
        },
      });
    }
    state.adminAssignmentForm = {
      courseId: String(state.adminStreamCourseId || ""),
      title: "",
      type: "short",
      dueAt: "",
      publishAt: "",
      rubricTemplate: "",
      timerSeconds: 60,
      quizQuestion: "",
      quizOptionA: "",
      quizOptionB: "",
      quizOptionC: "",
      quizOptionD: "",
      quizAnswerKey: "A",
      quizExplanation: "",
      commentText: "",
    };
    persistAdminStudioDrafts();
    await loadDataDrivenCollections();
    pushToast("success", "Assignment created.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to create assignment.");
  }
}

async function saveAdminContentComment() {
  try {
    const payload = {
      courseId: String(state.adminCommentForm.courseId || "").trim(),
      contentType: String(state.adminCommentForm.contentType || "").trim(),
      contentId: String(state.adminCommentForm.contentId || "").trim(),
      text: String(state.adminCommentForm.text || "").trim(),
    };
    if (!payload.courseId || !payload.contentType || !payload.contentId || !payload.text) {
      pushToast("error", "Course, target type, target ID, and comment are required.");
      return;
    }
    await apiRequest("/admin/comments", { method: "POST", body: payload });
    state.adminCommentForm = {
      courseId: String(state.adminStreamCourseId || ""),
      contentType: state.adminCommentForm.contentType || "announcement",
      contentId: "",
      text: "",
    };
    await loadDataDrivenCollections();
    pushToast("success", "Comment posted.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to post comment.");
  }
}

async function deleteAdminCourse(id) {
  try {
    await apiRequest(`/admin/courses/${id}`, { method: "DELETE" });
    pushToast("success", "Course deleted.");
    await refreshAdminPageData();
  } catch (err) {
    pushToast("error", err.message || "Failed to delete course.");
  }
}

function updateAdminBookForm(key, value) {
  state.adminBookForm[key] = value;
}

function updateAdminBookSearch(value) {
  state.adminBookSearch = value;
  renderAdminBookCatalogOnly();
}

function getFilteredAdminBooks() {
  const q = String(state.adminBookSearch || "").trim().toLowerCase();
  return (state.adminBooks || []).filter((b) => {
    if (!q) return true;
    return [b.title, b.category, b.type, b.country, b.area, b.description].some((v) =>
      String(v || "").toLowerCase().includes(q)
    );
  });
}

function renderAdminBookCatalogOnly() {
  if (state.page !== "admin" || state.adminPage !== "books") return;
  const listNode = document.getElementById("admin-book-list");
  const countNode = document.getElementById("admin-book-count");
  if (!listNode || !countNode) return;
  const visibleBooks = getFilteredAdminBooks();
  countNode.textContent = `${visibleBooks.length} visible`;
  listNode.innerHTML =
    visibleBooks
      .map(
        (b) => `<div class="item">
          <div class="split">
            <strong>${b.title}</strong>
            <span class="pill">Stock ${b.stock ?? 0}</span>
          </div>
          <p class="muted">${b.category || "General"} · ${b.type || "Book"} · ${b.country || "N/A"} ${b.area ? `(${b.area})` : ""}</p>
          <p class="muted">${b.description || "No description."}</p>
          <p><strong>RM ${Number(b.price || 0).toFixed(2)}</strong></p>
          <div class="button-row"><button class="button button-secondary" onclick="editAdminBook('${b.id}')">Edit</button><button class="button button-secondary" onclick="deleteAdminBook('${b.id}')">Delete</button></div>
        </div>`
      )
      .join("") || `<p class="muted">No books found for this search.</p>`;
}

async function handleAdminBookImageFile(inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiRequest("/admin/uploads/image", { method: "POST", body: formData });
    state.adminBookForm.image = String(res?.item?.url || "");
    pushToast("success", "Book image uploaded.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to upload book image.");
  }
}

function formatChatTime(input) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadStudentChat() {
  const unreadBefore = state.chatState.unreadCount;
  state.supportLoading = true;
  state.supportError = "";
  if (state.chatState.isOpen) render();
  try {
    const payload = await apiRequest("/chat/me");
    const incoming = Array.isArray(payload) ? payload : payload.items || [];
    const previousCount = state.chatState.messages.length;
    state.supportMessages = incoming;
    state.chatState.messages = incoming;
    if (!state.chatState.isOpen && incoming.length > previousCount) {
      state.chatState.unreadCount += incoming.length - previousCount;
    }
  } catch (err) {
    state.supportError = err.message || "Failed to load support chat.";
  } finally {
    state.supportLoading = false;
    if (state.chatState.isOpen || state.chatState.unreadCount !== unreadBefore) render();
  }
}

function updateSupportDraft(value) {
  state.supportDraft = value;
}

function toggleChatWidget() {
  state.chatState.isOpen = !state.chatState.isOpen;
  if (state.chatState.isOpen) {
    state.chatState.unreadCount = 0;
    if (!state.chatState.messages.length && !state.supportLoading) {
      loadStudentChat().then(() => render());
    }
  }
  render();
}

function closeChatWidget() {
  state.chatState.isOpen = false;
  render();
}

function setupChatPolling() {
  if (chatPollingTimer) {
    clearInterval(chatPollingTimer);
    chatPollingTimer = null;
  }
  if (!state.isLoggedIn || state.authRole !== "student") return;
  chatPollingTimer = setInterval(() => {
    loadStudentChat();
  }, 10000);
}

function chatInputKeydown(event) {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  sendSupportMessage();
}

async function sendSupportMessage() {
  const text = state.supportDraft.trim();
  if (!text) {
    pushToast("error", "Please type a message.");
    return;
  }
  try {
    await apiRequest("/chat/me", { method: "POST", body: { message: text } });
    state.supportDraft = "";
    await loadStudentChat();
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to send message.");
  }
}

async function selectAdminChatUser(userId) {
  state.adminSelectedChatUserId = String(userId);
  state.adminLoading = true;
  render();
  try {
    await adminFetchSelectedChatMessages();
  } catch (err) {
    state.adminError = err.message || "Failed to load user chat.";
  } finally {
    state.adminLoading = false;
    render();
  }
}

function updateAdminChatDraft(value) {
  state.adminChatDraft = value;
}

async function sendAdminChatReply() {
  const text = state.adminChatDraft.trim();
  if (!text || !state.adminSelectedChatUserId) {
    pushToast("error", "Select a user and type a message.");
    return;
  }
  try {
    await apiRequest(`/admin/chats/users/${state.adminSelectedChatUserId}/messages`, {
      method: "POST",
      body: { message: text },
    });
    state.adminChatDraft = "";
    await adminFetchSelectedChatMessages();
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to send reply.");
  }
}

function editAdminBook(bookId) {
  const book = state.adminBooks.find((item) => String(item.id) === String(bookId));
  if (!book) return;
  state.adminBookForm = {
    id: book.id || "",
    title: book.title || "",
    price: Number(book.price || 0),
    country: book.country || "",
    area: book.area || "",
    type: book.type || "",
    category: book.category || "",
    description: book.description || "",
    image: book.image || "",
    stock: Number(book.stock || 0),
  };
  render();
}

async function saveAdminBook() {
  try {
    const payload = {
      title: state.adminBookForm.title.trim(),
      price: Number(state.adminBookForm.price || 0),
      country: state.adminBookForm.country.trim(),
      area: state.adminBookForm.area.trim(),
      type: state.adminBookForm.type.trim(),
      category: state.adminBookForm.category.trim(),
      description: String(state.adminBookForm.description || "").trim(),
      image: state.adminBookForm.image.trim(),
      stock: Number(state.adminBookForm.stock || 0),
    };
    if (!payload.title) {
      pushToast("error", "Book title is required.");
      return;
    }
    if (state.adminBookForm.id) {
      await apiRequest(`/admin/books/${state.adminBookForm.id}`, { method: "PUT", body: payload });
      pushToast("success", "Book updated.");
    } else {
      await apiRequest("/admin/books", { method: "POST", body: payload });
      pushToast("success", "Book created.");
    }
    state.adminBookForm = { id: "", title: "", price: 0, country: "", area: "", type: "", category: "", description: "", image: "", stock: 0 };
    await refreshAdminPageData();
  } catch (err) {
    pushToast("error", err.message || "Failed to save book.");
  }
}

async function deleteAdminBook(id) {
  try {
    await apiRequest(`/admin/books/${id}`, { method: "DELETE" });
    pushToast("success", "Book deleted.");
    await refreshAdminPageData();
  } catch (err) {
    pushToast("error", err.message || "Failed to delete book.");
  }
}

async function deleteAdminForumPost(id) {
  try {
    await apiRequest(`/admin/forum-posts/${id}`, { method: "DELETE" });
    pushToast("success", "Forum post deleted.");
    await refreshAdminPageData();
  } catch (err) {
    pushToast("error", err.message || "Failed to delete forum post.");
  }
}

async function deleteAdminForumReply(replyId) {
  try {
    await apiRequest(`/admin/forum-replies/${encodeURIComponent(replyId)}`, { method: "DELETE" });
    pushToast("success", "Reply removed.");
    await adminFetchForumPosts();
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to delete reply.");
  }
}

async function submitAdminForumReplyFromCard(postId) {
  const card = document.querySelector(`.admin-forum-post[data-post-id="${String(postId)}"]`);
  const ta = card && card.querySelector("textarea.admin-forum-reply-input");
  const text = (ta && ta.value ? ta.value : "").trim();
  if (!text) {
    pushToast("error", "Write a reply first.");
    return;
  }
  try {
    await apiRequest(`/admin/forum-posts/${encodeURIComponent(postId)}/replies`, { method: "POST", body: { message: text } });
    if (ta) ta.value = "";
    await adminFetchForumPosts();
    pushToast("success", "Reply posted.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to post reply.");
  }
}

async function submitJoinCourseByCode() {
  const el = document.getElementById("join-course-code-input");
  const raw = (el && el.value ? el.value : "").trim();
  if (!raw) {
    pushToast("error", "Enter a join code.");
    return;
  }
  const code = raw.toUpperCase().replace(/\s+/g, "");
  try {
    await joinCourseByCodeApi(code);
    if (el) el.value = "";
    await loadDataDrivenCollections();
    await refreshCourseProgress();
    pushToast("success", "You have joined the course.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Could not join this course.");
  }
}

async function copyJoinCodeToClipboard(code) {
  const c = String(code || "").trim();
  if (!c) return;
  try {
    await navigator.clipboard.writeText(c);
    pushToast("success", "Join code copied.");
  } catch {
    pushToast("error", "Unable to copy to clipboard.");
  }
}

async function updateAdminUserRole(id, role) {
  try {
    await apiRequest(`/admin/users/${id}`, { method: "PATCH", body: { role } });
    pushToast("success", "User role updated.");
    await refreshAdminPageData();
  } catch (err) {
    pushToast("error", err.message || "Failed to update user role.");
  }
}

function editAdminUser(userId) {
  const user = state.adminUsers.find((item) => String(item.id) === String(userId));
  if (!user) return;
  state.adminUserForm = {
    id: user.id,
    name: user.name || "",
    email: user.email || "",
    role: user.role || "user",
  };
  render();
}

function updateAdminUserForm(key, value) {
  state.adminUserForm[key] = value;
}

async function saveAdminUser() {
  try {
    const payload = {
      name: String(state.adminUserForm.name || "").trim(),
      email: String(state.adminUserForm.email || "").trim(),
      role: String(state.adminUserForm.role || "user").trim(),
    };
    if (!state.adminUserForm.id) {
      pushToast("error", "Select a user first.");
      return;
    }
    if (!payload.name || !payload.email) {
      pushToast("error", "Name and email are required.");
      return;
    }
    await apiRequest(`/admin/users/${state.adminUserForm.id}`, { method: "PATCH", body: payload });
    state.adminUserForm = { id: "", name: "", email: "", role: "user" };
    pushToast("success", "User updated.");
    await refreshAdminPageData();
  } catch (err) {
    pushToast("error", err.message || "Failed to update user.");
  }
}

async function deleteAdminUser(id) {
  try {
    await apiRequest(`/admin/users/${id}`, { method: "DELETE" });
    if (String(state.adminUserForm.id) === String(id)) {
      state.adminUserForm = { id: "", name: "", email: "", role: "user" };
    }
    pushToast("success", "User deleted.");
    await refreshAdminPageData();
  } catch (err) {
    pushToast("error", err.message || "Failed to delete user.");
  }
}

async function deleteAdminMaterial(id) {
  try {
    await apiRequest(`/admin/materials/${id}`, { method: "DELETE" });
    await loadDataDrivenCollections();
    pushToast("success", "Material removed.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to remove material.");
  }
}

async function deleteAdminAnnouncement(id) {
  try {
    await apiRequest(`/admin/announcements/${id}`, { method: "DELETE" });
    await loadDataDrivenCollections();
    pushToast("success", "Announcement removed.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to remove announcement.");
  }
}

async function deleteAdminAssignment(id) {
  try {
    await apiRequest(`/admin/assignments/${id}`, { method: "DELETE" });
    await loadDataDrivenCollections();
    pushToast("success", "Assignment removed.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to remove assignment.");
  }
}

function logout() {
  if (chatPollingTimer) {
    clearInterval(chatPollingTimer);
    chatPollingTimer = null;
  }
  if (quizTimerTicker) {
    clearInterval(quizTimerTicker);
    quizTimerTicker = null;
  }
  clearSession();
  state.isLoggedIn = false;
  state.authToken = "";
  state.authRole = "student";
  state.currentUser = null;
  state.page = "landing";
  state.authMode = "login";
  state.authDraft = { name: "", email: "", password: "", confirmPassword: "" };
  state.mobileNavOpen = false;
  state.userScoped = {
    progressByCourse: {},
    savedAnnouncements: {},
    cart: {},
    orders: [],
  };
  state.adminStats = null;
  state.adminCourses = [];
  state.adminBooks = [];
  state.adminForumPosts = [];
  state.adminUsers = [];
  state.adminChatUsers = [];
  state.adminSelectedChatUserId = "";
  state.adminChatMessages = [];
  state.adminChatDraft = "";
  state.adminCourseForm = { id: "", name: "", lecturerName: "" };
  state.adminStreamCourseId = "";
  state.adminMaterialForm = { courseId: "", name: "", commentText: "", publishAt: "" };
  state.adminAnnouncementForm = { courseId: "", title: "", text: "", publishAt: "" };
  state.adminAssignmentForm = {
    courseId: "",
    title: "",
    type: "short",
    dueAt: "",
    publishAt: "",
    rubricTemplate: "",
    timerSeconds: 60,
    quizQuestion: "",
    quizOptionA: "",
    quizOptionB: "",
    quizOptionC: "",
    quizOptionD: "",
    quizAnswerKey: "A",
    quizExplanation: "",
    commentText: "",
  };
  state.adminCommentForm = { courseId: "", contentType: "announcement", contentId: "", text: "" };
  state.adminStudioTab = "materials";
  localStorage.removeItem("edutech_admin_studio_drafts");
  state.adminBookSearch = "";
  state.supportMessages = [];
  state.supportDraft = "";
  state.supportError = "";
  state.supportLoading = false;
  state.chatState = {
    isOpen: false,
    messages: [],
    unreadCount: 0,
  };
  state.courseTab = "Announcements";
  state.dropdownOpen = false;
  render();
}

function toggleDropdown(event) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
  state.dropdownOpen = !state.dropdownOpen;
  render();
}

function toggleMaterial(index) {
  state.materialOpen[index] = !state.materialOpen[index];
  render();
}

function toggleAssignment(id) {
  state.assignmentOpen[id] = !state.assignmentOpen[id];
  render();
}

function toggleNotifications() {
  state.showAllNotifications = !state.showAllNotifications;
  render();
}

function toggleAnnouncementComment(id) {
  const wasOpen = !!state.announcementCommentOpen[id];
  Object.keys(state.announcementCommentOpen).forEach((key) => {
    state.announcementCommentOpen[key] = false;
  });
  state.announcementCommentOpen[id] = !wasOpen;
  render();
}

async function toggleAnnouncementSave(id) {
  try {
    const isSaved = !!state.userScoped.savedAnnouncements[id];
    if (isSaved) {
      await unsaveAnnouncementApi(id);
      delete state.userScoped.savedAnnouncements[id];
      addNotification("Announcement Unsaved", "Removed from your reminders.");
      pushToast("info", "Announcement removed from reminders.");
    } else {
      await saveAnnouncementApi(id);
      state.userScoped.savedAnnouncements[id] = true;
      addNotification("Announcement Saved", "Added to your reminders.");
      pushToast("success", "Announcement saved.");
    }
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to update saved announcement.");
  }
}

function updateAnnouncementCommentDraft(id, value) {
  state.announcementCommentDrafts[id] = value;
}

async function postAnnouncementComment(id) {
  const text = String(state.announcementCommentDrafts[id] || "").trim();
  if (!text) {
    pushToast("error", "Please write a comment first.");
    return;
  }
  const announcement = data.announcements.find((a) => String(a.id) === String(id));
  if (!announcement?.courseId) {
    pushToast("error", "Invalid announcement target.");
    return;
  }
  try {
    await apiRequest("/comments", {
      method: "POST",
      body: {
        courseId: announcement.courseId,
        contentType: "announcement",
        contentId: id,
        text,
      },
    });
    state.announcementCommentDrafts[id] = "";
    await loadDataDrivenCollections();
    addNotification("Announcement Comment", "Your comment has been posted.");
    pushToast("success", "Comment posted.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to post comment.");
  }
}

function updateForumSearch(value) {
  state.forumSearch = value;
  forumSearchTerm = value;
  if (state.postLoginPage === "forum") {
    renderForumPostsOnly();
    return;
  }
  render();
}

function updateForumSort(value) {
  state.forumSort = value;
  if (state.postLoginPage === "forum") {
    renderForumPostsOnly();
    return;
  }
  render();
}

function updateForumTag(value) {
  state.forumTag = value;
  if (state.postLoginPage === "forum") {
    renderForumPostsOnly();
    return;
  }
  render();
}

function setBookFilter(key, value) {
  const normalized = value || "All";
  state.bookFilters[key] = normalized;
  if (key === "country" || key === "area" || key === "type") {
    filterState[key] = value || "";
  }
  const priceLabel = document.getElementById("book-price-range-label");
  if (priceLabel) {
    priceLabel.textContent = `Price range: RM ${state.bookFilters.minPrice} - RM ${state.bookFilters.maxPrice}`;
  }
  if (state.postLoginPage === "bookstore") {
    renderBookstoreGridOnly();
    return;
  }
  render();
}

function unreadNotificationsCount() {
  return data.notifications.filter((n) => !n.read).length;
}

function addNotification(title, text) {
  const item = {
    id: `n${Date.now()}`,
    title,
    text,
    time: "Just now",
    read: false,
  };
  data.notifications.unshift(item);
  while (data.notifications.length > 50) {
    data.notifications.pop();
  }
}

function openNotificationsCenter(event) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
  state.notificationsOpen = !state.notificationsOpen;
  render();
}

function markAllNotificationsRead() {
  data.notifications.forEach((n) => {
    n.read = true;
  });
  render();
}

function markNotificationRead(id) {
  const item = data.notifications.find((n) => n.id === id);
  if (!item) return;
  item.read = true;
  render();
}

async function loadUserScopedData() {
  try {
    await loadDataDrivenCollections();
    const payload = await apiRequest("/me/data");
    state.userScoped = {
      progressByCourse: payload.progressByCourse || {},
      savedAnnouncements: payload.savedAnnouncements || {},
      cart: payload.cart || {},
      orders: payload.orders || [],
    };
    if (payload.user) {
      state.currentUser = payload.user;
      data.user = {
        name: payload.user.name || data.user.name,
        email: payload.user.email || data.user.email,
      };
      state.profileDraft = {
        ...state.profileDraft,
        name: data.user.name,
        email: data.user.email,
        bio: payload.user.bio || state.profileDraft.bio || "",
      };
      state.settingsDraft = {
        ...state.settingsDraft,
        language: payload.user.language || state.settingsDraft.language,
        theme: payload.user.theme || state.settingsDraft.theme,
        notificationPref: payload.user.notificationPref || state.settingsDraft.notificationPref,
      };
    }
  } catch (err) {
    pushToast("error", err.message || "Failed to load user data.");
  }
  await refreshCourseProgress();
}

async function adminFetchStats() {
  state.adminStats = await apiRequest("/admin/stats");
}

async function adminFetchCourses() {
  const payload = await apiRequest("/admin/courses");
  state.adminCourses = Array.isArray(payload) ? payload : payload.items || [];
  if (!state.adminStreamCourseId && state.adminCourses.length > 0) {
    setAdminStreamCourse(state.adminCourses[0].id);
  } else if (state.adminStreamCourseId && !state.adminCourses.some((c) => String(c.id) === String(state.adminStreamCourseId))) {
    setAdminStreamCourse(state.adminCourses.length ? state.adminCourses[0].id : "");
  }
}

async function adminFetchBooks() {
  const payload = await apiRequest("/admin/books");
  state.adminBooks = Array.isArray(payload) ? payload : payload.items || [];
}

async function adminFetchForumPosts() {
  const payload = await apiRequest("/admin/forum-posts");
  state.adminForumPosts = Array.isArray(payload) ? payload : payload.items || [];
}

async function adminFetchUsers() {
  const payload = await apiRequest("/admin/users");
  state.adminUsers = Array.isArray(payload) ? payload : payload.items || [];
}

async function adminFetchChatUsers() {
  const payload = await apiRequest("/admin/chats/users");
  state.adminChatUsers = Array.isArray(payload) ? payload : payload.items || [];
}

async function adminFetchSelectedChatMessages() {
  if (!state.adminSelectedChatUserId) {
    state.adminChatMessages = [];
    return;
  }
  const payload = await apiRequest(`/admin/chats/users/${state.adminSelectedChatUserId}/messages`);
  state.adminChatMessages = Array.isArray(payload) ? payload : payload.items || [];
}

async function refreshAdminPageData() {
  state.adminLoading = true;
  state.adminError = "";
  render();
  try {
    await loadDataDrivenCollections();
    if (state.adminPage === "dashboard") await adminFetchStats();
    if (state.adminPage === "courses") await adminFetchCourses();
    if (state.adminPage === "books") await adminFetchBooks();
    if (state.adminPage === "forum") await adminFetchForumPosts();
    if (state.adminPage === "users") await adminFetchUsers();
    if (state.adminPage === "support") {
      await adminFetchChatUsers();
      if (!state.adminSelectedChatUserId && state.adminChatUsers.length > 0) {
        state.adminSelectedChatUserId = String(state.adminChatUsers[0].id);
      }
      await adminFetchSelectedChatMessages();
    }
  } catch (err) {
    state.adminError = err.message || "Failed to load admin data.";
  } finally {
    state.adminLoading = false;
    render();
    if (state.adminPage === "books") {
      renderAdminBookCatalogOnly();
    }
  }
}

async function addToCart(bookTitle) {
  try {
    const book = (data.books || []).find((b) => b.title === bookTitle);
    if (!book?.id) {
      pushToast("error", "Book not found.");
      return;
    }
    await addCartItemApi(book.id, 1);
    state.userScoped.cart[bookTitle] = (state.userScoped.cart[bookTitle] || 0) + 1;
    addNotification("Cart Updated", `${bookTitle} was added to your cart.`);
    pushToast("success", `${bookTitle} added to cart.`);
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to add item to cart.");
  }
}

async function removeFromCart(bookTitle) {
  try {
    const book = (data.books || []).find((b) => b.title === bookTitle);
    if (book?.id) {
      await removeCartItemApi(book.id);
    }
    delete state.userScoped.cart[bookTitle];
    pushToast("success", "Item removed from cart.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to remove item.");
  }
}

async function changeCartQty(bookTitle, delta) {
  try {
    const current = state.userScoped.cart[bookTitle] || 0;
    const nextQty = current + delta;
    const book = (data.books || []).find((b) => b.title === bookTitle);
    if (!book?.id) {
      pushToast("error", "Book not found.");
      return;
    }
    if (nextQty <= 0) {
      await removeCartItemApi(book.id);
      delete state.userScoped.cart[bookTitle];
    } else {
      await updateCartItemApi(book.id, nextQty);
      state.userScoped.cart[bookTitle] = nextQty;
    }
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to update quantity.");
  }
}

async function clearCart() {
  try {
    await clearCartApi();
    state.userScoped.cart = {};
    pushToast("success", "Cart cleared.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to clear cart.");
  }
}

async function checkoutCart() {
  const itemsCount = Object.values(state.userScoped.cart).reduce((a, b) => a + b, 0);
  if (itemsCount === 0) {
    addNotification("Checkout", "Your cart is empty.");
    pushToast("error", "Your cart is empty.");
    render();
    return;
  }
  addNotification("Checkout", `Proceed to payment for ${itemsCount} item(s).`);
  pushToast("success", "Redirecting to payment...");
  state.postLoginPage = "payment";
  render();
}

function previewBook(bookTitle) {
  state.previewBook = bookTitle;
  addNotification("Book Preview", `You opened preview for ${bookTitle}.`);
  render();
}

function closePreview() {
  state.previewBook = null;
  render();
}

function askQuestion() {
  state.forumComposerOpen = !state.forumComposerOpen;
  render();
}

function viewPost(postId) {
  const post = data.forum.find((p) => String(p.id) === String(postId));
  addNotification("Forum", `Viewing post: ${post?.title || "post"}`);
  state.forumViewingPost = String(postId);
  render();
}

function replyPost(postId) {
  state.forumReplyTo = String(postId);
  state.forumReplyDraft = "";
  render();
}

function saveProfile() {
  updateProfileApi();
}

function updateSettings() {
  updateSettingsApi();
}

function updateProfileField(key, value) {
  state.profileDraft[key] = value;
}

function updateSettingsField(key, value) {
  state.settingsDraft[key] = value;
}

async function updateProfileApi() {
  try {
    const payload = {
      name: String(state.profileDraft.name || "").trim(),
      email: String(state.profileDraft.email || "").trim(),
      bio: String(state.profileDraft.bio || "").trim(),
    };
    if (!payload.name || !payload.email) {
      pushToast("error", "Name and email are required.");
      return;
    }
    await apiRequest("/me/profile", { method: "PATCH", body: payload });
    data.user.name = payload.name;
    data.user.email = payload.email;
    addNotification("Profile", "Your profile changes were saved.");
    pushToast("success", "Profile updated.");
    await loadUserScopedData();
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to update profile.");
  }
}

async function updateSettingsApi() {
  try {
    const payload = {
      language: String(state.settingsDraft.language || "").trim(),
      theme: String(state.settingsDraft.theme || "").trim(),
      notificationPref: String(state.settingsDraft.notificationPref || "").trim(),
    };
    await apiRequest("/me/settings", { method: "PATCH", body: payload });
    addNotification("Settings", `Language: ${payload.language}, Theme: ${payload.theme}.`);
    pushToast("success", "Settings updated.");
    await loadUserScopedData();
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to update settings.");
  }
}

function setCourseFilter(value) {
  state.courseFilter = value;
  if (state.postLoginPage === "courses") {
    renderCoursesListOnly();
    return;
  }
  render();
}

function setCourseSearch(value) {
  state.courseSearch = value;
  courseSearchTerm = value;
  if (state.postLoginPage === "courses") {
    renderCoursesListOnly();
    return;
  }
  render();
}

function setCourseSort(value) {
  state.courseSort = value;
  if (state.postLoginPage === "courses") {
    renderCoursesListOnly();
    return;
  }
  render();
}

function openCourseResources(courseName) {
  setCourse(courseName);
  state.courseTab = "Material";
  addNotification("Course Resources", `Opened resources for ${courseName}.`);
  pushToast("info", `Viewing ${courseName} materials.`);
  render();
}

function startQuizIfNeeded(assignmentId) {
  if (!state.quizStartAtByAssignment[assignmentId]) {
    state.quizStartAtByAssignment[assignmentId] = Date.now();
  }
  if (!quizTimerTicker) {
    quizTimerTicker = setInterval(() => {
      state.quizTimerNow = Date.now();
      if (state.page !== "admin" && state.postLoginPage === "courses" && state.courseTab === "Assignment") {
        render();
      }
    }, 1000);
  }
}

function selectMcqOption(assignmentId, questionId, option) {
  startQuizIfNeeded(assignmentId);
  const prev = state.quizDraftAnswers[assignmentId] || {};
  state.quizDraftAnswers[assignmentId] = { ...prev, [questionId]: option };
  state.selectedMcqOption[assignmentId] = option;
  render();
}

async function submitMcqAnswer(assignmentId) {
  const assignment = (data.assignments || []).find((item) => String(item.id) === String(assignmentId)) || {};
  const answers = state.quizDraftAnswers[assignmentId] || {};
  if (!Object.keys(answers).length) {
    pushToast("error", "Please answer at least one question.");
    return;
  }
  const timerSeconds = Number(assignment?.timerSeconds || 0);
  if (timerSeconds > 0 && state.quizStartAtByAssignment[assignmentId]) {
    const elapsed = Math.floor((Date.now() - state.quizStartAtByAssignment[assignmentId]) / 1000);
    if (elapsed > timerSeconds) {
      delete state.quizStartAtByAssignment[assignmentId];
      pushToast("error", "Time is up. Please restart this quiz.");
      return;
    }
  }
  try {
    const res = await submitQuizToApi(assignmentId, { answers });
    const attempt = res?.item || {};
    state.quizHistoryByAssignment[assignmentId] = attempt;
    addNotification("Quiz", `Score ${attempt.score || 0}/${attempt.total || 0}`);
    pushToast("success", `Quiz submitted. Score ${attempt.score || 0}/${attempt.total || 0}`);
    await submitAssignment(assignmentId, "MCQ quiz submission");
  } catch (err) {
    pushToast("error", err.message || "Failed to submit quiz.");
  }
}

function updateCommentDraft(key, value) {
  state.commentDrafts[key] = value;
}

function updateShortAnswerDraft(assignmentId, value) {
  state.shortAnswerDrafts[assignmentId] = value;
}

function generateRandomMaterialSample() {
  const templates = [
    { type: "PPT", filePath: "sample-materials/chapter-1-introduction.ppt", baseName: "Lecture Slides" },
    { type: "XLS", filePath: "sample-materials/group-formation-namelist.xls", baseName: "Attendance Sheet" },
    { type: "PDF", filePath: "sample-materials/chapter-2-hypertext-markup.pdf", baseName: "Study Notes" },
    { type: "W", filePath: "sample-materials/chapter-3-introduction.doc", baseName: "Class Handout" },
  ];
  const picked = templates[Math.floor(Math.random() * templates.length)];
  state.materialSeed += 1;
  const item = {
    id: `m${Date.now()}`,
    name: `${picked.baseName} ${state.materialSeed}`,
    type: picked.type,
    filePath: picked.filePath,
  };
  data.materials.unshift(item);
  addNotification("Material", `${item.name} sample file created.`);
  pushToast("success", `${item.name} added.`);
  render();
}

function updateForumDraft(value) {
  state.forumDraft = value;
}

function forumSampleImage() {
  const images = [
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1000&q=80",
  ];
  return images[Math.floor(Math.random() * images.length)];
}

async function submitForumQuestion() {
  const text = state.forumDraft.trim();
  if (!text) {
    pushToast("error", "Please write your question first.");
    return;
  }
  try {
    await createForumPost({
      title: text,
      content: text,
      tag: state.forumTag === "All" ? "Tips" : state.forumTag,
      image: forumSampleImage(),
    });
    await loadDataDrivenCollections();
    state.forumDraft = "";
    state.forumComposerOpen = false;
    addNotification("Forum", "Question posted successfully.");
    pushToast("success", "Question posted.");
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to post question.");
  }
}

function updateForumReply(value) {
  state.forumReplyDraft = value;
}

async function submitForumReply() {
  const text = state.forumReplyDraft.trim();
  if (!state.forumReplyTo || !text) {
    pushToast("error", "Please write a reply first.");
    return;
  }
  try {
    await replyForumPost(state.forumReplyTo, { message: text });
    await loadDataDrivenCollections();
    const post = data.forum.find((p) => String(p.id) === String(state.forumReplyTo));
    addNotification("Forum", `Reply posted to "${post?.title || "post"}".`);
    pushToast("success", "Reply posted.");
    state.forumReplyTo = null;
    state.forumReplyDraft = "";
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to post reply.");
  }
}

function cancelForumReply() {
  state.forumReplyTo = null;
  state.forumReplyDraft = "";
  render();
}

function setBookSearch(value) {
  state.bookSearch = value;
  if (state.postLoginPage === "bookstore") {
    renderBookstoreGridOnly();
    return;
  }
  render();
}

function setBookSort(value) {
  state.bookSort = value;
  if (state.postLoginPage === "bookstore") {
    renderBookstoreGridOnly();
    return;
  }
  render();
}

function setBookTag(value) {
  state.bookTag = value;
  if (state.postLoginPage === "bookstore") {
    renderBookstoreGridOnly();
    return;
  }
  render();
}

function submitAction(actionName) {
  addNotification("Submission", `${actionName} completed.`);
  pushToast("success", `${actionName} completed.`);
  render();
}

async function postComment(key) {
  const text = String(state.commentDrafts[key] || "").trim();
  if (!text) {
    pushToast("error", "Please type a comment first.");
    return;
  }
  const selectedCourse = data.courses.find((c) => c.name === state.selectedCourse);
  if (!selectedCourse?.id) {
    pushToast("error", "Course context not found.");
    return;
  }
  const contentType = key.includes("-material-comments")
    ? "material"
    : key.includes("-comments")
      ? "assignment"
      : "";
  const contentId = key.replace("-material-comments", "").replace("-comments", "");
  if (!contentType || !contentId) {
    pushToast("error", "Invalid comment target.");
    return;
  }
  try {
    await apiRequest("/comments", {
      method: "POST",
      body: {
        courseId: selectedCourse.id,
        contentType,
        contentId,
        text,
      },
    });
    addNotification("Comment", "Comment posted.");
    pushToast("success", "Comment posted.");
    state.commentDrafts[key] = "";
    await loadDataDrivenCollections();
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to post comment.");
  }
}

function formatSubmittedTime(ts) {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function submitAssignment(assignmentId, sourceLabel) {
  const assignment = data.assignments.find((a) => a.id === assignmentId);
  if (!assignment) return;
  if (assignment.type === "short" && !String(state.shortAnswerDrafts[assignmentId] || "").trim()) {
    pushToast("error", "Please write your short answer before submitting.");
    return;
  }
  try {
    const res = await submitAssignmentToApi(assignmentId, { sourceLabel });
    const item = res.item || {};
    state.assignmentSubmissions[assignmentId] = {
      submittedAt: item.submittedAt || Date.now(),
      isLate: !!item.isLate,
      sourceLabel: item.sourceLabel || sourceLabel,
    };
    addNotification(
      "Assignment Submitted",
      `${assignment.title} submitted${item.isLate ? " (Late)" : ""}.`
    );
    pushToast(
      item.isLate ? "info" : "success",
      `${assignment.title} submitted${item.isLate ? " (Late)" : ""}.`
    );
    await refreshCourseProgress();
    render();
  } catch (err) {
    pushToast("error", err.message || "Failed to submit assignment.");
  }
}

function resetBookFilters() {
  state.bookFilters = {
    country: "All",
    area: "All",
    type: "All",
    minPrice: 0,
    maxPrice: 200,
  };
  filterState = { country: "", area: "", type: "" };
  state.bookSearch = "";
  state.bookSort = "featured";
  state.bookTag = "Featured";
  pushToast("success", "Filters reset.");
  if (state.postLoginPage === "bookstore") {
    const countrySelect = document.getElementById("book-filter-country");
    const areaSelect = document.getElementById("book-filter-area");
    const typeSelect = document.getElementById("book-filter-type");
    if (countrySelect) countrySelect.value = "";
    if (areaSelect) areaSelect.value = "";
    if (typeSelect) typeSelect.value = "";
    const searchInput = document.getElementById("book-search-input");
    if (searchInput) searchInput.value = "";
    const priceSlider = document.getElementById("book-max-price");
    if (priceSlider) priceSlider.value = "200";
    const priceLabel = document.getElementById("book-price-range-label");
    if (priceLabel) priceLabel.textContent = "Price range: RM 0 - RM 200";
    renderBookstoreGridOnly();
    return;
  }
  render();
}

function updatePaymentField(key, value) {
  if (key === "cardNumber") {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    state.paymentDraft[key] = digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
    return;
  }
  if (key === "expiry") {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    state.paymentDraft[key] = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    return;
  }
  if (key === "cvc") {
    state.paymentDraft[key] = value.replace(/\D/g, "").slice(0, 3);
    return;
  }
  state.paymentDraft[key] = value;
}

async function processPayment(event) {
  event.preventDefault();
  const btn = event.target.querySelector("button[type='submit']");
  const { fullName, email, cardNumber, expiry, cvc } = state.paymentDraft;
  if (!fullName || !email || !cardNumber || !expiry || !cvc) {
    pushToast("error", "Please complete all payment fields.");
    return;
  }
  if (!validateEmail(email)) {
    pushToast("error", "Invalid email format.");
    return;
  }
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Loading...";
  pushToast("loading", "Processing payment...", 1000);
  try {
    const res = await checkoutOrder({ ...state.paymentDraft, cart: state.userScoped.cart });
    if (res.status === "success") {
      addNotification("Payment Success", `Order ${res.orderId} paid successfully.`);
      pushToast("success", `Payment success: ${res.orderId}`);
      state.userScoped.cart = {};
      state.paymentDraft = { fullName: "", email: "", cardNumber: "", expiry: "", cvc: "" };
      state.postLoginPage = "bookstore";
      render();
    } else {
      pushToast("error", "Payment failed.");
    }
  } catch {
    pushToast("error", "Payment failed.");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

function imagePlaceholder(label, className = "") {
  return `<div class="image-placeholder ${className}">${label}</div>`;
}

function ringProgress(value) {
  return `
    <div class="ring" style="--p:${value};">
      <div class="ring-inner">${value}%</div>
    </div>
  `;
}

function getEnrolledCourseIdSet() {
  return new Set((data.courses || []).map((c) => String(c.id)));
}

function assignmentsForCurrentStudent() {
  const ids = getEnrolledCourseIdSet();
  return (data.assignments || []).filter((a) => ids.has(String(a.courseId)));
}

function getEffectiveCourses() {
  return data.courses.map((course) => {
    const courseId = String(course.id || course.name);
    const apiProgress = state.courseProgressById[courseId];
    if (typeof apiProgress === "number") {
      return { ...course, progress: apiProgress };
    }
    const scoped = state.userScoped.progressByCourse[course.name];
    if (typeof scoped === "number") {
      return { ...course, progress: scoped };
    }
    return { ...course, progress: 0 };
  });
}

function nav() {
  const tabs = ["home", "courses", "forum", "bookstore"];
  const unread = unreadNotificationsCount();
  return `
    <nav class="navbar">
      <div class="brand-wrap clickable-brand" onclick="setPostLoginPage('home')">
        <img src="logo.png" alt="EDUTECH logo" class="logo-img" />
        <div class="logo logo-large">
          <span class="logo-mark">EDU</span>
          <span class="logo-text">TECH</span>
        </div>
      </div>
      <button class="nav-toggle" aria-label="Toggle navigation menu" onclick="toggleMobileNav()">☰</button>
      <div class="nav-links ${state.mobileNavOpen ? "mobile-nav-open" : ""}">
        ${tabs
          .map(
            (tab) =>
              `<button class="nav-link ${state.postLoginPage === tab || (tab === "courses" && state.postLoginPage === "courseDetail") ? "active" : ""}" onclick="setPostLoginPage('${tab}')">${
                tab.charAt(0).toUpperCase() + tab.slice(1)
              }</button>`
          )
          .join("")}
      </div>
      <div class="user-wrap">
        <button class="mail-button" title="Notifications" onclick="openNotificationsCenter(event)">✉${unread ? `<span class="mail-badge">${unread}</span>` : ""}</button>
        <div class="notification-pop ${state.notificationsOpen ? "" : "hidden"}">
          <div class="split">
            <strong>Notifications</strong>
            <button class="button button-secondary compact-btn" onclick="markAllNotificationsRead()">Mark all</button>
          </div>
          <div class="notification-list">
            ${data.notifications
              .slice(0, 6)
              .map(
                (n) => `
              <article class="item notification-item ${n.read ? "" : "notification-unread"}">
                <div class="split">
                  <strong>${n.title}</strong>
                  <small>${n.time}</small>
                </div>
                <p class="muted">${n.text}</p>
                ${n.read ? "" : `<button class="button button-secondary compact-btn" onclick="markNotificationRead('${n.id}')">Mark read</button>`}
              </article>`
              )
              .join("")}
          </div>
        </div>
        <button class="user-button" onclick="toggleDropdown(event)">
          <span class="avatar-sample">U</span>
        </button>
        <div class="user-dropdown ${state.dropdownOpen ? "" : "hidden"}">
          <button class="dropdown-item" onclick="setPostLoginPage('profile')">Account Profile</button>
          <button class="dropdown-item" onclick="setPostLoginPage('profile')">Settings</button>
          <button class="dropdown-item" onclick="logout()">Log out</button>
        </div>
      </div>
    </nav>
  `;
}

function landingView() {
  return `
    <div class="page fixed-frame">
      <nav class="navbar landing-navbar">
        <div class="brand-wrap">
          <img src="logo.png" alt="EDUTECH logo" class="logo-img logo-img-large" />
          <div class="logo logo-large">
            <span class="logo-mark">EDU</span>
            <span class="logo-text">TECH</span>
          </div>
        </div>
        <div class="nav-links"><!-- pre-login: links hidden --></div>
        <div class="button-row">
          <button class="button button-primary" onclick="setPreLoginPage('auth')">Login / Sign up</button>
          <button class="button button-secondary" onclick="setPreLoginPage('adminAuth')">Admin Login</button>
        </div>
      </nav>

      <section class="hero landing-hero">
        <div class="card landing-hero-card">
          <h1 class="hero-title landing-hero-title">Learn Smarter, Anywhere</h1>
          <p class="muted">Your all-in-one online learning platform.</p>
          <button class="button button-primary" onclick="setPreLoginPage('auth')">Get started</button>
        </div>
        <div class="card landing-hero-image-card">
          <img src="image1.png" alt="Learning illustration" class="hero-image-fit landing-hero-image" />
        </div>
      </section>
      <section class="grid-3 section-gap">
        <article class="card quick-card centered-card">
          <img src="image2.png" alt="Explore courses" class="quick-image-fit" />
          <h4 class="center-text">Explore courses</h4>
        </article>
        <article class="card quick-card centered-card">
          <img src="image3.png" alt="Join forum" class="quick-image-fit" />
          <h4 class="center-text">Join the forum</h4>
        </article>
        <article class="card quick-card centered-card">
          <img src="image4.png" alt="Visit bookstore" class="quick-image-fit" />
          <h4 class="center-text">Visit Bookstore</h4>
        </article>
      </section>
      <footer class="copyright">© 2026 EDUTECH. All rights reserved.</footer>
    </div>
  `;
}

function authView() {
  return `
    <main class="auth-wrap fixed-frame auth-background">
      <form class="card auth-card" data-auth-form="1">
        <div class="auth-switch">
          <button type="button" class="tag-btn ${state.authMode === "login" ? "active-tag" : ""}" onclick="setAuthMode('login')">Login</button>
          <button type="button" class="tag-btn ${state.authMode === "register" ? "active-tag" : ""}" onclick="setAuthMode('register')">Register</button>
        </div>
        <h2>${state.authMode === "login" ? "Login" : "Create Account"}</h2>
        <p class="muted">${state.authMode === "login" ? "Welcome back, continue your learning journey." : "Join EduTech to start learning smarter."}</p>
        ${
          state.authMode === "register"
            ? `<div class="field">
                <label>Full Name</label>
                <input type="text" name="name" placeholder="Your full name" value="${state.authDraft?.name || ""}" oninput="updateAuthDraft('name', this.value)" required />
              </div>`
            : ""
        }
        <div class="field">
          <label>Email</label>
          <input type="email" name="email" placeholder="Enter your email" value="${state.authDraft?.email || ""}" oninput="updateAuthDraft('email', this.value)" required />
        </div>
        <div class="field">
          <label>Password</label>
          <div class="password-field">
            <input type="password" name="password" placeholder="Enter your password" value="${state.authDraft?.password || ""}" oninput="updateAuthDraft('password', this.value)" required />
            <button type="button" class="button button-secondary compact-btn" onclick="togglePasswordVisibility(this, 'input[name=&quot;password&quot;]')">Show</button>
          </div>
        </div>
        ${
          state.authMode === "register"
            ? `<div class="field">
                <label>Confirm Password</label>
                <div class="password-field">
                  <input type="password" name="confirmPassword" placeholder="Re-enter password" value="${state.authDraft?.confirmPassword || ""}" oninput="updateAuthDraft('confirmPassword', this.value)" required />
                  <button type="button" class="button button-secondary compact-btn" onclick="togglePasswordVisibility(this, 'input[name=&quot;confirmPassword&quot;]')">Show</button>
                </div>
              </div>`
            : ""
        }
        <button class="button button-primary" type="submit">${state.authMode === "login" ? "Login" : "Register"}</button>
      </form>
    </main>
  `;
}

function adminAuthView() {
  return `
    <main class="auth-wrap fixed-frame auth-background">
      <form class="card auth-card" data-admin-auth-form="1">
        <h2>Admin Login</h2>
        <p class="muted">Sign in to manage users, courses, books, and forum content.</p>
        <div class="field">
          <label>Admin Email</label>
          <input type="email" name="email" placeholder="admin@edutech.com" required />
        </div>
        <div class="field">
          <label>Password</label>
          <div class="password-field">
            <input type="password" name="password" placeholder="••••••••" required />
            <button type="button" class="button button-secondary compact-btn" onclick="togglePasswordVisibility(this, 'input[name=&quot;password&quot;]')">Show</button>
          </div>
        </div>
        <div class="button-row">
          <button class="button button-secondary" type="button" onclick="setPreLoginPage('landing')">Back</button>
          <button class="button button-primary" type="submit">Admin Login</button>
        </div>
      </form>
    </main>
  `;
}

function adminNavView() {
  const tabs = [
    { id: "dashboard", label: "Command Center", icon: "📊" },
    { id: "courses", label: "Course Studio", icon: "🎓" },
    { id: "books", label: "Bookstore Ops", icon: "📚" },
    { id: "forum", label: "Forum Control", icon: "💬" },
    { id: "users", label: "User Management", icon: "👥" },
    { id: "support", label: "Support Desk", icon: "🛟" },
  ];
  const activeTab = tabs.find((tab) => tab.id === state.adminPage) || tabs[0];
  return `
    <section class="card admin-command-bar">
      <div class="admin-command-top">
        <div class="brand-wrap">
          <div class="logo logo-large">
            <span class="logo-mark">EDU</span><span class="logo-text">TECH Command</span>
          </div>
          <p class="muted">Run your entire platform with precision and speed.</p>
        </div>
        <div class="admin-command-actions">
          <button class="button button-secondary" onclick="logout()">Log out</button>
        </div>
      </div>
      <div class="admin-tab-strip">
        ${tabs
          .map(
            (tab) => `<button class="admin-tab ${state.adminPage === tab.id ? "admin-tab-active" : ""}" onclick="setAdminPage('${tab.id}')">
              <span>${tab.icon}</span><span>${tab.label}</span>
            </button>`
          )
          .join("")}
      </div>
      <div class="admin-command-bottom">
        <span class="pill">Current Workspace: ${activeTab.label}</span>
        <span class="pill">Role: Administrator</span>
      </div>
    </section>
  `;
}

function adminPageContent() {
  if (state.adminLoading) return `<section class="card"><p class="muted">Loading admin data...</p></section>`;
  if (state.adminError) return `<section class="card"><p class="muted">${state.adminError}</p></section>`;

  if (state.adminPage === "dashboard") {
    const s = state.adminStats || {};
    const totalMaterials = (data.materials || []).length;
    const totalAssignments = (data.assignments || []).length;
    const totalAnnouncements = (data.announcements || []).length;
    return `
      <section class="card admin-page-hero">
        <div>
          <h2>Platform Command Center</h2>
          <p class="muted">Track growth, monitor live academic content, and jump to action in seconds.</p>
        </div>
        <div class="admin-hero-kpis">
          <span class="pill">Materials ${totalMaterials}</span>
          <span class="pill">Assignments ${totalAssignments}</span>
          <span class="pill">Announcements ${totalAnnouncements}</span>
        </div>
      </section>
      <section class="dashboard-stats">
        <article class="card stat-card admin-stat-card"><div class="stat-label">Total Users</div><div class="stat-big">${s.totalUsers ?? 0}</div></article>
        <article class="card stat-card admin-stat-card"><div class="stat-label">Total Courses</div><div class="stat-big">${s.totalCourses ?? 0}</div></article>
        <article class="card stat-card admin-stat-card"><div class="stat-label">Total Books</div><div class="stat-big">${s.totalBooks ?? 0}</div></article>
        <article class="card stat-card admin-stat-card"><div class="stat-label">Total Orders</div><div class="stat-big">${s.totalOrders ?? 0}</div></article>
        <article class="card stat-card admin-stat-card"><div class="stat-label">Forum Posts</div><div class="stat-big">${s.totalForumPosts ?? 0}</div></article>
      </section>
      <section class="dashboard-grid">
        <article class="card admin-surface">
          <h3>Teacher Uploads</h3>
          ${(data.materials || []).length
            ? data.materials
                .slice(0, 6)
                .map((m) => {
                  const cn =
                    (data.courses || []).find((c) => String(c.id) === String(m.courseId))?.name || `Course ${m.courseId}`;
                  return `<div class="item"><strong>${m.name}</strong><p class="muted">${m.type} · ${escapeHtml(cn)}</p></div>`;
                })
                .join("")
            : `<p class="muted">No uploaded materials yet.</p>`}
        </article>
        <article class="card admin-surface">
          <h3>Latest Assignments</h3>
          ${(data.assignments || []).length
            ? data.assignments
                .slice(0, 6)
                .map((a) => `<div class="item"><strong>${a.title}</strong><p class="muted">${a.type.toUpperCase()} · ${a.due || "No due date"}</p></div>`)
                .join("")
            : `<p class="muted">No assignments published yet.</p>`}
        </article>
        <article class="card admin-surface">
          <h3>Recent Announcements</h3>
          ${(data.announcements || []).length
            ? data.announcements
                .slice(0, 6)
                .map((a) => `<div class="item"><strong>${a.title}</strong><p class="muted">${a.meta || ""}</p></div>`)
                .join("")
            : `<p class="muted">No announcements published yet.</p>`}
        </article>
      </section>
    `;
  }

  if (state.adminPage === "courses") {
    const selectedStreamCourseId = String(state.adminStreamCourseId || "");
    return `
      <section class="card admin-page-hero">
        <div>
          <h2>Course Studio</h2>
          <p class="muted">Create courses quickly. Open one subject card to manage its full classroom actions.</p>
        </div>
      </section>
      <section class="card admin-stream-card admin-surface">
        <h3>Course Builder</h3>
        <div class="grid-2">
          <div class="field"><label>Course Name</label><input value="${state.adminCourseForm.name}" oninput="updateAdminCourseForm('name', this.value)" /></div>
          <div class="field"><label>Course Lecturer Name</label><input value="${state.adminCourseForm.lecturerName || ""}" oninput="updateAdminCourseForm('lecturerName', this.value)" /></div>
        </div>
        <div class="button-row">
          <button class="button button-primary" onclick="saveAdminCourse()">${state.adminCourseForm.id ? "Update Course" : "Add Course"}</button>
        </div>
      </section>
      <section class="admin-course-accordion">
        ${(state.adminCourses || [])
          .map((c) => {
            const isOpen = String(c.id) === selectedStreamCourseId;
            const courseMaterials = (data.materials || []).filter((m) => String(m.courseId) === String(c.id));
            const courseAnnouncements = (data.announcements || []).filter((a) => String(a.courseId) === String(c.id));
            const courseAssignments = (data.assignments || []).filter((a) => String(a.courseId) === String(c.id));
            return `
              <article class="card admin-surface admin-subject-card ${isOpen ? "admin-subject-card-open" : ""}">
                <div class="split">
                  <div>
                    <h3>${escapeHtml(c.name || "")}</h3>
                    <p class="muted">Lecturer: ${escapeHtml(c.lecturerName || "Lecturer")}</p>
                    ${
                      c.joinCode
                        ? `<p class="muted">Join code: <strong>${escapeHtml(c.joinCode)}</strong>
                        <button type="button" class="button button-secondary compact-btn" onclick="copyJoinCodeToClipboard('${String(c.joinCode).replace(/'/g, "\\'")}')">Copy</button></p>`
                        : ""
                    }
                  </div>
                  <div class="button-row">
                    <button class="button button-secondary" onclick="setAdminStreamCourse('${c.id}')">${isOpen ? "Collapse" : "Open Subject"}</button>
                    <button class="button button-secondary" onclick="editAdminCourse('${c.id}')">Edit</button>
                    <button class="button button-secondary" onclick="deleteAdminCourse('${c.id}')">Delete</button>
                  </div>
                </div>
                <div class="admin-course-stream-meta">
                  <span class="pill">Materials ${courseMaterials.length}</span>
                  <span class="pill">Announcements ${courseAnnouncements.length}</span>
                  <span class="pill">Assignments ${courseAssignments.length}</span>
                </div>
                ${
                  !isOpen
                    ? ""
                    : `<div class="admin-subject-body">
                        <section class="card admin-stream-card admin-surface">
                          <h4>Classroom Actions</h4>
                          <div class="admin-mini-tabs">
                            <button class="admin-mini-tab ${state.adminStudioTab === "materials" ? "admin-mini-tab-active" : ""}" onclick="setAdminStudioTab('materials')">Materials</button>
                            <button class="admin-mini-tab ${state.adminStudioTab === "announcements" ? "admin-mini-tab-active" : ""}" onclick="setAdminStudioTab('announcements')">Announcements</button>
                            <button class="admin-mini-tab ${state.adminStudioTab === "assignments" ? "admin-mini-tab-active" : ""}" onclick="setAdminStudioTab('assignments')">Assignments</button>
                          </div>
                          <div class="admin-stream-grid admin-stream-grid-single">
                            ${
                              state.adminStudioTab === "materials"
                                ? `<article class="card admin-stream-block admin-surface">
                                    <h4>Upload Material</h4>
                                    <div class="grid-2">
                                      <div class="field"><label>Course</label><input value="${c.name}" disabled /></div>
                                      <div class="field"><label>Lecture Note Title</label><input value="${state.adminMaterialForm.name}" oninput="updateAdminMaterialForm('name', this.value)" /></div>
                                      <div class="field" style="grid-column:1 / -1;"><label>Select File (pdf/mp4/doc/etc.)</label><input id="admin-material-file" type="file" /></div>
                                      <div class="field"><label>Publish At (optional)</label><input type="datetime-local" value="${state.adminMaterialForm.publishAt || ""}" oninput="updateAdminMaterialForm('publishAt', this.value)" /></div>
                                      <div class="field" style="grid-column:1 / -1;"><label>Comment for this Material (optional)</label><textarea placeholder="Explain what students need to do with this material..." oninput="updateAdminMaterialForm('commentText', this.value)">${state.adminMaterialForm.commentText || ""}</textarea></div>
                                    </div>
                                    <div class="button-row"><button class="button button-primary" onclick="saveAdminMaterial()">Upload Material</button></div>
                                  </article>`
                                : ""
                            }
                            ${
                              state.adminStudioTab === "announcements"
                                ? `<article class="card admin-stream-block admin-surface">
                                    <h4>Post Announcement</h4>
                                    <div class="grid-2">
                                      <div class="field"><label>Course</label><input value="${c.name}" disabled /></div>
                                      <div class="field"><label>Announcement Title</label><input value="${state.adminAnnouncementForm.title}" oninput="updateAdminAnnouncementForm('title', this.value)" /></div>
                                      <div class="field" style="grid-column:1 / -1;"><label>Announcement Text</label><textarea oninput="updateAdminAnnouncementForm('text', this.value)">${state.adminAnnouncementForm.text}</textarea></div>
                                      <div class="field"><label>Publish At (optional)</label><input type="datetime-local" value="${state.adminAnnouncementForm.publishAt || ""}" oninput="updateAdminAnnouncementForm('publishAt', this.value)" /></div>
                                    </div>
                                    <div class="button-row"><button class="button button-primary" onclick="saveAdminAnnouncement()">Post Announcement</button></div>
                                  </article>`
                                : ""
                            }
                            ${
                              state.adminStudioTab === "assignments"
                                ? `<article class="card admin-stream-block admin-surface">
                                    <h4>Set Assignment</h4>
                                    <div class="grid-2">
                                      <div class="field"><label>Course</label><input value="${c.name}" disabled /></div>
                                      <div class="field"><label>Assignment Title</label><input value="${state.adminAssignmentForm.title}" oninput="updateAdminAssignmentForm('title', this.value)" /></div>
                                      <div class="field"><label>Assignment Type</label>
                                        <select onchange="updateAdminAssignmentForm('type', this.value)">
                                          <option value="short" ${state.adminAssignmentForm.type === "short" ? "selected" : ""}>Short</option>
                                          <option value="mcq" ${state.adminAssignmentForm.type === "mcq" ? "selected" : ""}>MCQ</option>
                                          <option value="upload" ${state.adminAssignmentForm.type === "upload" ? "selected" : ""}>Upload</option>
                                        </select>
                                      </div>
                                      <div class="field"><label>Due Date & Time</label><input type="datetime-local" value="${state.adminAssignmentForm.dueAt}" oninput="updateAdminAssignmentForm('dueAt', this.value)" /></div>
                                      <div class="field"><label>Publish At (optional)</label><input type="datetime-local" value="${state.adminAssignmentForm.publishAt || ""}" oninput="updateAdminAssignmentForm('publishAt', this.value)" /></div>
                                      <div class="field" style="grid-column:1 / -1;"><label>Rubric Template</label><textarea placeholder="Criteria, marks, and expectation..." oninput="updateAdminAssignmentForm('rubricTemplate', this.value)">${state.adminAssignmentForm.rubricTemplate || ""}</textarea></div>
                                      ${
                                        state.adminAssignmentForm.type === "mcq"
                                          ? `<div class="field"><label>Quiz Timer (seconds)</label><input type="number" min="10" value="${state.adminAssignmentForm.timerSeconds || 60}" oninput="updateAdminAssignmentForm('timerSeconds', this.value)" /></div>
                                             <div class="field" style="grid-column:1 / -1;"><label>Quiz Question</label><input value="${state.adminAssignmentForm.quizQuestion || ""}" oninput="updateAdminAssignmentForm('quizQuestion', this.value)" /></div>
                                             <div class="field"><label>Option A</label><input value="${state.adminAssignmentForm.quizOptionA || ""}" oninput="updateAdminAssignmentForm('quizOptionA', this.value)" /></div>
                                             <div class="field"><label>Option B</label><input value="${state.adminAssignmentForm.quizOptionB || ""}" oninput="updateAdminAssignmentForm('quizOptionB', this.value)" /></div>
                                             <div class="field"><label>Option C</label><input value="${state.adminAssignmentForm.quizOptionC || ""}" oninput="updateAdminAssignmentForm('quizOptionC', this.value)" /></div>
                                             <div class="field"><label>Option D</label><input value="${state.adminAssignmentForm.quizOptionD || ""}" oninput="updateAdminAssignmentForm('quizOptionD', this.value)" /></div>
                                             <div class="field" style="grid-column:1 / -1;"><label>Correct Answer</label>
                                               <select onchange="updateAdminAssignmentForm('quizAnswerKey', this.value)">
                                                 <option value="A" ${String(state.adminAssignmentForm.quizAnswerKey || "A") === "A" ? "selected" : ""}>Option A</option>
                                                 <option value="B" ${String(state.adminAssignmentForm.quizAnswerKey || "A") === "B" ? "selected" : ""}>Option B</option>
                                                 <option value="C" ${String(state.adminAssignmentForm.quizAnswerKey || "A") === "C" ? "selected" : ""}>Option C</option>
                                                 <option value="D" ${String(state.adminAssignmentForm.quizAnswerKey || "A") === "D" ? "selected" : ""}>Option D</option>
                                               </select>
                                             </div>
                                             <div class="field" style="grid-column:1 / -1;"><label>Explanation (shown after submit)</label><textarea oninput="updateAdminAssignmentForm('quizExplanation', this.value)">${state.adminAssignmentForm.quizExplanation || ""}</textarea></div>`
                                          : ""
                                      }
                                      <div class="field" style="grid-column:1 / -1;"><label>Attachment (PDF / DOCX / PPT… optional)</label><input id="admin-assignment-attachment" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /></div>
                                      <div class="field" style="grid-column:1 / -1;"><label>Comment for this Assignment (optional)</label><textarea placeholder="Explain submission requirement or rubric..." oninput="updateAdminAssignmentForm('commentText', this.value)">${state.adminAssignmentForm.commentText || ""}</textarea></div>
                                    </div>
                                    <div class="button-row"><button class="button button-primary" onclick="saveAdminAssignment()">Set Assignment</button></div>
                                  </article>`
                                : ""
                            }
                          </div>
                        </section>
                        <section class="card admin-stream-card admin-surface">
                          <h4>Enrolled students (${(state.adminEnrollments || []).length})</h4>
                          ${
                            (state.adminEnrollments || []).length
                              ? (state.adminEnrollments || [])
                                  .map(
                                    (u) =>
                                      `<div class="item"><div class="split"><strong>${escapeHtml(u.name || "")}</strong><span class="pill">${escapeHtml(u.role || "user")}</span></div><p class="muted">${escapeHtml(u.email || "")}</p></div>`
                                  )
                                  .join("")
                              : `<p class="muted">No enrollments yet. Students join with the course code.</p>`
                          }
                        </section>
                        <section class="card admin-stream-card admin-surface">
                          <h4>Published Content for ${c.name}</h4>
                          <div class="grid-2">
                            <article class="card admin-surface">
                              <strong>Uploaded Materials</strong>
                              ${courseMaterials
                                .map(
                                  (m) => `<div class="item"><div class="split"><span>${m.name}</span><small>${m.type}</small></div><div class="button-row"><a class="button button-secondary" href="${escapeHtml(resolvePublicApiUrl(m.filePath || m.url || "#"))}" target="_blank" rel="noopener noreferrer">Open</a><button class="button button-secondary" onclick="deleteAdminMaterial('${m.id}')">Delete</button></div></div>`
                                )
                                .join("") || `<p class="muted">No materials uploaded yet.</p>`}
                            </article>
                            <article class="card admin-surface">
                              <strong>Course Announcements</strong>
                              ${courseAnnouncements
                                .map(
                                  (a) => `<div class="item"><div class="split"><span>${a.title}</span><small>${a.meta || ""}</small></div><div class="button-row"><button class="button button-secondary" onclick="deleteAdminAnnouncement('${a.id}')">Delete</button></div></div>`
                                )
                                .join("") || `<p class="muted">No announcements posted yet.</p>`}
                            </article>
                            <article class="card admin-surface" style="grid-column:1 / -1;">
                              <strong>Assignments</strong>
                              ${courseAssignments
                                .map(
                                  (a) => `<div class="item"><div class="split"><span>${a.title}</span><small>${a.due || "No due date"}</small></div><div class="button-row"><button class="button button-secondary" onclick="deleteAdminAssignment('${a.id}')">Delete</button></div></div>`
                                )
                                .join("") || `<p class="muted">No assignments posted yet.</p>`}
                            </article>
                          </div>
                        </section>
                      </div>`
                }
              </article>
            `;
          })
          .join("") || `<section class="card admin-surface"><p class="muted">No courses yet. Create one from Course Builder.</p></section>`}
      </section>
    `;
  }

  if (state.adminPage === "books") {
    const visibleBooks = getFilteredAdminBooks();
    const totalStock = (state.adminBooks || []).reduce((acc, b) => acc + Number(b.stock || 0), 0);
    const inventoryValue = (state.adminBooks || []).reduce((acc, b) => acc + Number(b.stock || 0) * Number(b.price || 0), 0);
    return `
      <section class="card admin-page-hero">
        <div>
          <h2>Bookstore Operations</h2>
          <p class="muted">Manage catalog, stock flow, pricing strategy, and storefront quality with confidence.</p>
        </div>
        <div class="admin-hero-kpis">
          <span class="pill">Titles ${state.adminBooks.length}</span>
          <span class="pill">Stock ${totalStock}</span>
          <span class="pill">Inventory RM ${inventoryValue.toFixed(2)}</span>
        </div>
      </section>
      <section class="admin-books-layout">
        <article class="card admin-surface">
          <h3>Book Editor</h3>
          <div class="grid-2">
            <div class="field"><label>Title</label><input value="${state.adminBookForm.title}" oninput="updateAdminBookForm('title', this.value)" /></div>
            <div class="field"><label>Price (RM)</label><input type="number" min="0" value="${state.adminBookForm.price}" oninput="updateAdminBookForm('price', this.value)" /></div>
            <div class="field"><label>Country</label><input value="${state.adminBookForm.country}" oninput="updateAdminBookForm('country', this.value)" /></div>
            <div class="field"><label>Area</label><input value="${state.adminBookForm.area}" oninput="updateAdminBookForm('area', this.value)" /></div>
            <div class="field"><label>Type</label><input value="${state.adminBookForm.type}" oninput="updateAdminBookForm('type', this.value)" /></div>
            <div class="field"><label>Category</label><input value="${state.adminBookForm.category}" oninput="updateAdminBookForm('category', this.value)" /></div>
            <div class="field" style="grid-column:1 / -1;"><label>Description</label><textarea oninput="updateAdminBookForm('description', this.value)">${state.adminBookForm.description || ""}</textarea></div>
            <div class="field"><label>Image URL</label><input value="${state.adminBookForm.image}" oninput="updateAdminBookForm('image', this.value)" /></div>
            <div class="field"><label>Upload Image</label><input type="file" accept="image/*" onchange="handleAdminBookImageFile(this)" /></div>
            <div class="field"><label>Stock</label><input type="number" min="0" value="${state.adminBookForm.stock}" oninput="updateAdminBookForm('stock', this.value)" /></div>
          </div>
          <div class="button-row">
            <button class="button button-primary" onclick="saveAdminBook()">${state.adminBookForm.id ? "Update Book" : "Add Book"}</button>
          </div>
        </article>
        <article class="card admin-surface">
          <div class="split">
            <h3>Catalog</h3>
            <span class="pill" id="admin-book-count">${visibleBooks.length} visible</span>
          </div>
          <div class="field">
            <label>Search by title/category/type/country</label>
            <input value="${state.adminBookSearch}" oninput="updateAdminBookSearch(this.value)" placeholder="Search catalog..." />
          </div>
          <div class="admin-book-list" id="admin-book-list">
            ${visibleBooks
              .map(
                (b) => `<div class="item admin-book-row">
                  <div class="admin-book-row-main">
                    ${b.image ? `<img src="${escapeHtml(b.image)}" alt="" class="admin-book-thumb" />` : `<div class="admin-book-thumb admin-book-thumb-placeholder">📚</div>`}
                    <div>
                  <div class="split">
                    <strong>${b.title}</strong>
                    <span class="pill">Stock ${b.stock ?? 0}</span>
                  </div>
                  <p class="muted">${b.category || "General"} · ${b.type || "Book"} · ${b.country || "N/A"} ${b.area ? `(${b.area})` : ""}</p>
                  <p class="muted">${b.description || "No description."}</p>
                  <p><strong>RM ${Number(b.price || 0).toFixed(2)}</strong></p>
                  <div class="button-row"><button class="button button-secondary" onclick="editAdminBook('${b.id}')">Edit</button><button class="button button-secondary" onclick="deleteAdminBook('${b.id}')">Delete</button></div>
                    </div>
                  </div>
                </div>`
              )
              .join("") || `<p class="muted">No books found for this search.</p>`}
          </div>
        </article>
      </section>
    `;
  }

  if (state.adminPage === "forum") {
    return `
      <section class="card admin-page-hero">
        <div>
          <h2>Forum Control</h2>
          <p class="muted">Moderate conversations, keep community quality high, and remove harmful content quickly.</p>
        </div>
      </section>
      <section class="card admin-surface">
        <h3>Manage Forum Posts</h3>
        ${(state.adminForumPosts || [])
          .map((p) => {
            const replies = (p.replyList || [])
              .map(
                (r) => `<div class="forum-admin-reply">
                  <div class="split">
                    <strong>${r.authorRole === "admin" ? `<span class="pill pill-amber">Admin</span> ` : ""}${escapeHtml(r.authorName || "")}</strong>
                    <button type="button" class="button button-secondary compact-btn" onclick="deleteAdminForumReply('${r.id}')">Delete reply</button>
                  </div>
                  <p>${escapeHtml(r.text || "")}</p>
                  <small class="muted">${formatChatTime(r.createdAt)}</small>
                </div>`
              )
              .join("");
            return `<div class="item admin-forum-post" data-post-id="${p.id}">
              <strong>${escapeHtml(p.title || "")}</strong>
              <p class="muted">${escapeHtml(p.author || "Unknown")} · ${escapeHtml(p.tag || "General")}</p>
              <p class="muted forum-admin-post-snippet">${escapeHtml(String(p.content || "").slice(0, 220))}${String(p.content || "").length > 220 ? "…" : ""}</p>
              ${replies ? `<div class="forum-admin-replies">${replies}</div>` : ""}
              <div class="field" style="margin-top:10px;">
                <label>Admin reply</label>
                <textarea class="admin-forum-reply-input" rows="2" placeholder="Official response visible to students…"></textarea>
              </div>
              <div class="button-row">
                <button type="button" class="button button-primary" onclick="submitAdminForumReplyFromCard('${p.id}')">Post admin reply</button>
                <button type="button" class="button button-secondary" onclick="deleteAdminForumPost('${p.id}')">Delete post</button>
              </div>
            </div>`;
          })
          .join("")}
      </section>
    `;
  }

  if (state.adminPage === "support") {
    const selectedUser = state.adminChatUsers.find(
      (u) => String(u.id) === String(state.adminSelectedChatUserId)
    );
    return `
      <section class="card admin-page-hero">
        <div>
          <h2>Support Desk</h2>
          <p class="muted">Respond to learners faster and keep every support conversation organized.</p>
        </div>
      </section>
      <section class="card admin-chat-layout admin-surface">
        <aside class="admin-chat-users">
          <h3>Student Conversations</h3>
          ${(state.adminChatUsers || [])
            .map(
              (u) => `
              <button class="course-pill ${String(u.id) === String(state.adminSelectedChatUserId) ? "course-pill-active" : ""}" onclick="selectAdminChatUser('${u.id}')">
                <strong>${u.name || u.email || "Student"}</strong>
                <small class="muted">${u.email || ""}</small>
              </button>`
            )
            .join("") || `<p class="muted">No conversations yet.</p>`}
        </aside>
        <div class="admin-chat-main">
          <div class="split">
            <h3>Chat with ${selectedUser?.name || selectedUser?.email || "Student"}</h3>
          </div>
          <div class="chat-thread">
            ${(state.adminChatMessages || [])
              .map((m) => {
                const fromAdmin = (m.senderRole || m.role || "").toLowerCase() === "admin";
                return `<article class="chat-msg ${fromAdmin ? "chat-msg-admin" : "chat-msg-student"}">
                  <div class="chat-msg-meta"><strong>${fromAdmin ? "Admin" : m.senderName || "Student"}</strong><small>${formatChatTime(m.createdAt || m.timestamp)}</small></div>
                  <p>${m.message || m.text || ""}</p>
                </article>`;
              })
              .join("") || `<p class="muted">Select a user to view conversation.</p>`}
          </div>
          <div class="chat-compose">
            <input type="text" placeholder="Type a reply..." value="${state.adminChatDraft}" oninput="updateAdminChatDraft(this.value)" />
            <button class="button button-primary" onclick="sendAdminChatReply()">Send</button>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="card admin-page-hero">
      <div>
        <h2>User Management</h2>
        <p class="muted">Update user accounts, assign roles, and keep platform access secure and controlled.</p>
      </div>
    </section>
    <section class="card admin-surface">
      <h3>Manage Users</h3>
      <div class="grid-2">
        <div class="field"><label>Name</label><input value="${state.adminUserForm.name || ""}" oninput="updateAdminUserForm('name', this.value)" /></div>
        <div class="field"><label>Email</label><input value="${state.adminUserForm.email || ""}" oninput="updateAdminUserForm('email', this.value)" /></div>
        <div class="field"><label>Role</label><select onchange="updateAdminUserForm('role', this.value)"><option value="user" ${state.adminUserForm.role === "user" ? "selected" : ""}>Student</option><option value="admin" ${state.adminUserForm.role === "admin" ? "selected" : ""}>Admin</option></select></div>
      </div>
      <div class="button-row">
        <button class="button button-primary" onclick="saveAdminUser()">Save User</button>
      </div>
      ${(state.adminUsers || [])
        .map(
          (u) => `<div class="item"><div class="split"><strong>${u.name || u.email}</strong><span>${u.role || "student"}</span></div><p class="muted">${u.email || ""}</p><div class="button-row"><button class="button button-secondary" onclick="editAdminUser('${u.id}')">Edit</button><button class="button button-secondary" onclick="updateAdminUserRole('${u.id}', 'student')">Set Student</button><button class="button button-secondary" onclick="updateAdminUserRole('${u.id}', 'admin')">Set Admin</button><button class="button button-secondary" onclick="deleteAdminUser('${u.id}')">Delete</button></div></div>`
        )
        .join("")}
    </section>
  `;
}

function adminView() {
  return `
    <div class="page wide-page fixed-frame admin-control-shell">
      ${adminNavView()}
      ${adminPageContent()}
    </div>
  `;
}

function bindAuthForm() {
  const authForm = document.querySelector("[data-auth-form='1']");
  if (!authForm || authForm.dataset.boundAuthSubmit) return;
  authForm.dataset.boundAuthSubmit = "1";
  authForm.addEventListener("submit", (event) => {
    if (state.authMode === "register") register(event);
    else login(event);
  });
}

function bindAdminAuthForm() {
  const adminForm = document.querySelector("[data-admin-auth-form='1']");
  if (!adminForm || adminForm.dataset.boundAdminSubmit) return;
  adminForm.dataset.boundAdminSubmit = "1";
  adminForm.addEventListener("submit", (event) => adminLogin(event));
}

function homeView() {
  const courses = getEffectiveCourses();
  const overall = Math.round(
    courses.reduce((total, item) => total + item.progress, 0) / Math.max(courses.length, 1)
  );

  return `
    <div class="page wide-page fixed-frame">
    ${nav()}
    <section class="dashboard-stats">
      <article class="card stat-card">
        <div class="stat-label">Overall Progress</div>
        <div class="stat-big">${overall}%</div>
      </article>
      <article class="card stat-card">
        <div class="stat-label">Active Courses</div>
        <div class="stat-big">${courses.length}</div>
      </article>
      <article class="card stat-card">
        <div class="stat-label">Assignments</div>
        <div class="stat-big">${assignmentsForCurrentStudent().length}</div>
      </article>
      <article class="card stat-card">
        <div class="stat-label">Unread Alerts</div>
        <div class="stat-big">${unreadNotificationsCount()}</div>
      </article>
    </section>

    <section class="dashboard-grid">
      <div class="card">
        <h2>Student Overview</h2>
        <div class="overview-block">
          ${ringProgress(overall)}
          <div>
            <strong>Overall Student Progress</strong>
            <p class="muted">You've completed ${overall}% of your classes' overall assigned coursework.</p>
            <div class="button-row">
              <button class="button button-primary" onclick="setPostLoginPage('courses')">Continue Learning</button>
              <button class="button button-secondary" onclick="setPostLoginPage('courseDetail')">Open Course Detail</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Course Progress</h3>
        <div class="course-progress-list">
          ${courses
            .map(
              (course) => `
              <div class="progress-row">
                <span>${course.name}</span>
                <strong>${course.progress}%</strong>
              </div>`
            )
            .join("")}
        </div>
      </div>

      <div class="card">
        <h3>Upcoming Deadlines</h3>
        ${data.assignments
          .map(
            (a) =>
              `<div class="progress-row deadline-row"><span class="deadline-title">${a.title}</span><span class="muted deadline-due">Due ${a.due}</span></div>`
          )
          .join("")}
      </div>

      <div class="card">
        <div class="split">
          <h3 style="margin:0;">Notifications</h3>
          <span class="mail-icon">✉</span>
        </div>
        ${(state.showAllNotifications ? data.notifications : data.notifications.slice(0, 2))
          .map((n) => `<div class="item"><strong>${n.title}</strong><p class="muted">${n.text}</p><small>${n.time}</small></div>`)
          .join("")}
        <button class="button button-secondary" onclick="toggleNotifications()">
          ${state.showAllNotifications ? "Hide Notifications" : "View All Notifications"}
        </button>
      </div>

      <div class="card">
        <h3>Recent Forum Activity</h3>
        ${data.forum
          .slice(0, 3)
          .map(
            (f) =>
              `<div class="progress-row"><span>${f.title}</span><span class="muted">${f.replies} replies</span></div>`
          )
          .join("")}
        <button class="button button-secondary" onclick="setPostLoginPage('forum')">Go to Forum</button>
      </div>

      <div class="card">
        <h3>Quick Actions</h3>
        <div class="button-row">
          <button class="button button-primary" onclick="setPostLoginPage('courses')">My Courses</button>
          <button class="button button-secondary" onclick="setPostLoginPage('bookstore')">Bookstore</button>
          <button class="button button-secondary" onclick="setPostLoginPage('profile')">Account</button>
        </div>
      </div>
    </section>
    </div>
  `;
}

function getFilteredCourses() {
  const courses = getEffectiveCourses();
  let filteredCourses = courses.filter((course) =>
    course.name.toLowerCase().includes((courseSearchTerm || state.courseSearch).toLowerCase())
  );
  if (state.courseFilter === "progress") {
    filteredCourses = filteredCourses.filter((c) => c.progress > 0 && c.progress < 100);
  } else if (state.courseFilter === "completed") {
    filteredCourses = filteredCourses.filter((c) => c.progress >= 100);
  } else if (state.courseFilter === "recommended") {
    filteredCourses = filteredCourses.filter((c) => c.progress < 50);
  }
  return [...filteredCourses].sort((a, b) => {
    if (state.courseSort === "name-asc") return a.name.localeCompare(b.name);
    if (state.courseSort === "name-desc") return b.name.localeCompare(a.name);
    return b.progress - a.progress;
  });
}

function getFilteredForumPosts() {
  let posts = data.forum.filter(
    (p) =>
      p.title.toLowerCase().includes((forumSearchTerm || state.forumSearch).toLowerCase()) &&
      (state.forumTag === "All" || p.tag === state.forumTag)
  );
  if (state.forumSort === "replies") posts = posts.sort((a, b) => b.replies - a.replies);
  else if (state.forumSort === "likes") posts = posts.sort((a, b) => b.likes - a.likes);
  return posts;
}

function getFilteredBooks() {
  let filteredBooks = data.books.filter((book) => {
    if (state.bookFilters.country !== "All" && book.country !== state.bookFilters.country) return false;
    if (state.bookFilters.area !== "All" && book.area !== state.bookFilters.area) return false;
    if (state.bookFilters.type !== "All" && book.type !== state.bookFilters.type) return false;
    if (book.price < Number(state.bookFilters.minPrice) || book.price > Number(state.bookFilters.maxPrice)) return false;
    if (state.bookSearch && !book.title.toLowerCase().includes(state.bookSearch.toLowerCase())) return false;
    if (state.bookTag !== "Featured" && book.category !== state.bookTag) return false;
    return true;
  });
  return [...filteredBooks].sort((a, b) => {
    if (state.bookSort === "price-asc") return a.price - b.price;
    if (state.bookSort === "price-desc") return b.price - a.price;
    return a.title.localeCompare(b.title);
  });
}

function courseProgressStatus(progress) {
  const value = Number(progress || 0);
  if (value <= 0) return { text: "Start by today", className: "status-red" };
  if (value <= 25) return { text: "Keep it up", className: "status-orange" };
  if (value <= 75) return { text: "Almost there", className: "status-green" };
  return { text: "Incredible!", className: "status-blue" };
}

function courseCardsMarkup(courses) {
  return courses
    .map(
      (course) => {
        const status = courseProgressStatus(course.progress);
        return `
        <article class="card course-card course-card-redesign">
          <div class="course-top-row">
            <img src="${course.icon}" alt="${course.name} icon" class="course-hero-icon" />
            <div class="course-meta">
              <h4 class="course-title">${course.name}</h4>
              <p class="muted">Lecturer: ${data.lecturer.name}</p>
            </div>
            <span class="pill ${course.progress >= 100 ? "pill-green" : "pill-amber"}">${course.progress >= 100 ? "Completed" : "Active"}</span>
          </div>
          <div class="course-middle-row">
            <div class="ring ring-large" style="--p:${course.progress};"><div class="ring-inner ring-inner-large">${course.progress}%</div></div>
            <div class="course-action">
              <p class="status-text ${status.className}">${status.text}</p>
              <div class="progress-bar-wrap">
                <div class="progress"><div class="bar" style="width:${course.progress}%"></div></div>
              </div>
              <div class="button-row course-buttons">
                <button class="button button-primary start-btn" onclick="setCourse('${course.name}')">Open Course</button>
                <button class="button button-secondary" onclick="openCourseResources('${course.name}')">Resources</button>
              </div>
            </div>
          </div>
        </article>`;
      }
    )
    .join("");
}

function forumPostsMarkup(posts) {
  return posts
    .map(
      (post) => `
        <div class="item forum-post clean-row">
          <div class="forum-main">
            <span class="forum-avatar">${post.avatar || String((post.author || "U")[0] || "U").toUpperCase()}</span>
            <div class="forum-content">
              <strong>${post.pinned ? "📌 " : ""}${post.title}</strong>
              <p>${post.content || ""}</p>
              <p class="muted">${post.author} | ${post.replies} Replies | ${post.likes} Likes | ${post.last}</p>
            </div>
            ${post.image ? `<img src="${escapeHtml(resolvePublicApiUrl(post.image))}" alt="${post.title}" class="forum-post-image" />` : ""}
          </div>
          <div class="forum-actions">
            <button class="button button-secondary" onclick="viewPost('${post.id}')">View Post</button>
            <button class="button button-secondary" onclick="replyPost('${post.id}')">Reply</button>
          </div>
        </div>`
    )
    .join("");
}

function bookstoreCardsMarkup(filteredBooks) {
  return filteredBooks
    .map(
      (book) => `
          <article class="card bookstore-card">
            <img src="${escapeHtml(resolvePublicApiUrl(book.image))}" alt="${book.title}" class="book-image" />
            <div class="book-card-body">
              <div class="split">
                <span class="category-label">${book.category}</span>
                <span class="book-price">RM ${book.price.toFixed(2)}</span>
              </div>
              <h4>${book.title}</h4>
              <p class="muted">${book.type} · ${book.country}, ${book.area}</p>
              <div class="split">
                <button class="button button-secondary" onclick="previewBook('${book.title.replace(/'/g, "\\'")}')">Preview</button>
                <button class="button button-primary" onclick="addToCart('${book.title.replace(/'/g, "\\'")}')">Add to Cart</button>
              </div>
            </div>
          </article>`
    )
    .join("");
}

function renderForumPostsOnly() {
  const list = document.getElementById("forum-post-list");
  if (!list) return;
  list.innerHTML = forumPostsMarkup(getFilteredForumPosts());
}

function renderCoursesListOnly() {
  const list = document.getElementById("courses-list-container");
  if (!list) return;
  list.innerHTML = courseCardsMarkup(getFilteredCourses());
}

function renderBookstoreGridOnly() {
  const list = document.getElementById("bookstore-grid-container");
  const count = document.getElementById("bookstore-count");
  if (!list) return;
  const filteredBooks = getFilteredBooks();
  list.innerHTML = bookstoreCardsMarkup(filteredBooks);
  if (count) count.textContent = `${filteredBooks.length} resource(s) found`;
}

function coursesView() {
  const courses = getEffectiveCourses();
  const sortedCourses = getFilteredCourses();
  const overall = Math.round(courses.reduce((total, item) => total + item.progress, 0) / Math.max(courses.length, 1));
  const completed = courses.filter((c) => c.progress >= 100).length;

  return `
    <div class="page wide-page fixed-frame">
    ${nav()}
    <section class="courses-shell courses-redesign-shell">
      <div class="card courses-hero">
        <div>
          <h2>My Courses</h2>
          <p class="muted">Track your learning progress, continue classes, and manage your semester in one place.</p>
          <div class="courses-chip-row">
            <span class="category-label">Active Semester</span>
            <span class="category-label">Personalized Path</span>
            <span class="category-label">Skill Tracking</span>
          </div>
        </div>
        <div class="courses-hero-progress">
          ${ringProgress(overall)}
          <div>
            <strong>${overall}% Overall</strong>
            <p class="muted">${completed}/${courses.length} courses completed</p>
          </div>
        </div>
      </div>

      <div class="courses-toolbar">
        <div class="button-row">
          <button class="tag-btn ${state.courseFilter === "all" ? "active-tag" : ""}" onclick="setCourseFilter('all')">All Courses</button>
          <button class="tag-btn ${state.courseFilter === "progress" ? "active-tag" : ""}" onclick="setCourseFilter('progress')">In Progress</button>
          <button class="tag-btn ${state.courseFilter === "completed" ? "active-tag" : ""}" onclick="setCourseFilter('completed')">Completed</button>
          <button class="tag-btn ${state.courseFilter === "recommended" ? "active-tag" : ""}" onclick="setCourseFilter('recommended')">Recommended</button>
        </div>
        <div class="courses-toolbar-right">
          <input id="course-search-input" type="text" placeholder="Search courses..." value="${state.courseSearch}" oninput="setCourseSearch(this.value)" />
          <select onchange="setCourseSort(this.value)">
            <option value="progress" ${state.courseSort === "progress" ? "selected" : ""}>Sort: Progress</option>
            <option value="name-asc" ${state.courseSort === "name-asc" ? "selected" : ""}>Sort: Name A-Z</option>
            <option value="name-desc" ${state.courseSort === "name-desc" ? "selected" : ""}>Sort: Name Z-A</option>
          </select>
        </div>
      </div>

      <section class="card courses-join-card">
        <h3>Join a course</h3>
        <p class="muted">Ask your lecturer for the join code, then enter it here to add the class to My Courses.</p>
        <div class="courses-join-row">
          <input id="join-course-code-input" class="courses-join-input" type="text" placeholder="e.g. ABCD1234" autocomplete="off" />
          <button type="button" class="button button-primary" onclick="submitJoinCourseByCode()">Join</button>
        </div>
      </section>

      <div id="courses-list-container" class="course-list courses-grid">
        ${courseCardsMarkup(sortedCourses)}
      </div>
    </section>
    </div>
  `;
}

function assignmentOverviewView() {
  const selectedCourseObj = data.courses.find((c) => c.name === state.selectedCourse);
  const selectedCourseId = selectedCourseObj?.id != null ? String(selectedCourseObj.id) : null;
  const courseAssignments = selectedCourseId
    ? (data.assignments || []).filter((a) => String(a.courseId) === selectedCourseId)
    : [];
  if (!courseAssignments.length) {
    return `<article class="card course-tab-card"><p class="muted">No assignments yet. Admin has not uploaded any assignment for this course.</p></article>`;
  }
  return `
    ${courseAssignments
      .map(
        (assignment) => {
          const submission = state.assignmentSubmissions[assignment.id];
          return `
      <article class="card course-tab-card">
        <div class="split">
          <div>
            <strong>${assignment.title}</strong>
            <p class="muted file-meta">Type: ${assignment.type.toUpperCase()}</p>
          </div>
          <span class="pill pill-amber">due ${assignment.due}</span>
        </div>
        ${
          submission
            ? `<div class="assignment-status ${submission.isLate ? "assignment-status-late" : "assignment-status-on-time"}">
                <strong>${submission.isLate ? "Submitted Late" : "Submitted"}</strong>
                <span>${formatSubmittedTime(submission.submittedAt)}</span>
              </div>`
            : ""
        }
        <button class="button button-secondary" onclick="toggleAssignment('${assignment.id}')">${state.assignmentOpen[assignment.id] ? "Collapse" : "Expand"}</button>
        <div class="${state.assignmentOpen[assignment.id] ? "" : "hidden"} assignment-detail">
          ${renderAssignmentBody(assignment)}
        </div>
      </article>
    `;
        }
      )
      .join("")}
  `;
}

function renderAssignmentBody(assignment) {
  const submission = state.assignmentSubmissions[assignment.id];
  const attPath = assignment.attachmentPath || assignment.attachment_path;
  const attHref = resolvePublicApiUrl(attPath);
  const teacherAttachment = attPath
    ? `<div class="card"><h4>Teacher file</h4><p><a class="button button-secondary" href="${escapeHtml(attHref)}" target="_blank" rel="noopener noreferrer">Download attachment</a></p></div>`
    : "";
  const rubricBlock = assignment.rubricTemplate
    ? `<div class="card"><h4>Rubric</h4><p class="muted">${assignment.rubricTemplate}</p></div>`
    : "";
  const submissionReceipt = submission
    ? `<div class="submission-receipt ${submission.isLate ? "submission-receipt-late" : "submission-receipt-ok"}">
         <strong>${submission.isLate ? "Submitted Late" : "Submitted Successfully"}</strong>
         <p class="muted">Time: ${formatSubmittedTime(submission.submittedAt)} · Via ${submission.sourceLabel}</p>
       </div>`
    : "";

  if (assignment.type === "mcq") {
    const payload = assignment.quizPayload && Array.isArray(assignment.quizPayload.questions) ? assignment.quizPayload : { questions: [] };
    const questions = payload.questions;
    const startedAt = state.quizStartAtByAssignment[assignment.id];
    const timerSeconds = Number(assignment.timerSeconds || 0);
    const elapsed = startedAt ? Math.floor((state.quizTimerNow - startedAt) / 1000) : 0;
    const remaining = timerSeconds > 0 ? Math.max(timerSeconds - elapsed, 0) : 0;
    const latestAttempt = state.quizHistoryByAssignment[assignment.id];
    return `
      <div class="assignment-instruction">
        <strong>Instructions</strong>
        <p class="muted">Complete all MCQ questions and submit before timer ends.</p>
      </div>
      ${
        timerSeconds > 0
          ? `<p class="muted"><strong>Timer:</strong> ${remaining}s ${startedAt ? "" : "(starts when you choose first option)"}</p>`
          : ""
      }
      ${
        questions.length
          ? questions
              .map((q, idx) => {
                const qid = String(q.id || `q${idx + 1}`);
                const selected = (state.quizDraftAnswers[assignment.id] || {})[qid];
                return `<div class="card">
                  <strong>Q${idx + 1}. ${q.question || ""}</strong>
                  <div class="option-grid">
                    ${(q.options || [])
                      .map(
                        (opt) => `<button class="option-btn ${selected === opt ? "option-btn-selected" : ""}" onclick="selectMcqOption('${assignment.id}', '${qid}', '${String(opt).replace(/'/g, "\\'")}')">${opt}</button>`
                      )
                      .join("")}
                  </div>
                  ${latestAttempt?.createdAt ? `<p class="muted">Explanation: ${q.explanation || "No explanation provided."}</p>` : ""}
                </div>`;
              })
              .join("")
          : `<p class="muted">Quiz questions are not configured yet by admin.</p>`
      }
      <button class="button button-primary" onclick="submitMcqAnswer('${assignment.id}')">Submit Quiz</button>
      ${
        latestAttempt?.createdAt
          ? `<p class="muted"><strong>Latest score:</strong> ${latestAttempt.score}/${latestAttempt.total} · ${formatChatTime(latestAttempt.createdAt)}</p>`
          : ""
      }
      ${teacherAttachment}
      ${rubricBlock}
      ${submissionReceipt}
      ${commentsBlock(`${assignment.id}-comments`, "assignment", assignment.id)}
    `;
  }

  if (assignment.type === "upload") {
    return `
      <div class="assignment-instruction">
        <strong>Instructions</strong>
        <p class="muted">Upload your project package and mark as done once final files are ready.</p>
      </div>
      <div class="card">
        <h4>Your submission</h4>
        <div class="item">project-demo.mp4</div>
        <div class="item">index.html</div>
        <div class="item"><a href="sample-materials/group-formation-namelist.xls" target="_blank" rel="noopener noreferrer">Open attached resource (XLS)</a></div>
        <div class="button-row">
          <button class="button button-primary" onclick="submitAssignment('${assignment.id}', 'Upload file')">Upload</button>
          <button class="button button-secondary" onclick="submitAssignment('${assignment.id}', 'Mark as Done')">Mark as Done</button>
        </div>
      </div>
      ${teacherAttachment}
      ${rubricBlock}
      ${submissionReceipt}
      ${commentsBlock(`${assignment.id}-comments`, "assignment", assignment.id)}
    `;
  }

  return `
    ${teacherAttachment}
    <div class="assignment-instruction">
      <strong>Instructions</strong>
      <p class="muted">Write a short reflection and submit when complete.</p>
    </div>
    <p>What did you learn today? Write down your review here.</p>
    <textarea placeholder="Type your answer here." oninput="updateShortAnswerDraft('${assignment.id}', this.value)">${state.shortAnswerDrafts[assignment.id] || ""}</textarea>
    <button class="button button-primary" onclick="submitAssignment('${assignment.id}', 'Short answer submission')">Submit</button>
    ${rubricBlock}
    ${submissionReceipt}
    ${commentsBlock(`${assignment.id}-comments`, "assignment", assignment.id)}
  `;
}

function commentsBlock(key, contentType, contentId) {
  const postedComments = getContentComments(contentType, contentId);
  return `
    <div class="card comments">
      <div class="comment-head">
        <h4>Class comments</h4>
        <span class="pill pill-amber">Live Discussion</span>
      </div>
      <div class="comment-thread">
        ${postedComments
          .map(
            (c) => `
          <article class="comment-bubble ${c.authorRole === "admin" ? "comment-bubble-lecturer" : "comment-bubble-student"}">
            <strong>${c.authorName || "User"}</strong>
            <p>${c.text}</p>
            <small class="muted">${formatChatTime(c.createdAt)}</small>
          </article>`
          )
          .join("") || `<p class="muted">No comments yet.</p>`}
      </div>
      <div class="comment-compose">
        <div class="field">
          <input type="text" placeholder="Leave a comment" value="${state.commentDrafts[key] || ""}" oninput="updateCommentDraft('${key}', this.value)" />
        </div>
        <button class="button button-primary" onclick="postComment('${key}')">Post comment</button>
      </div>
    </div>
  `;
}

function renderCourseTabContent() {
  const selectedCourseObj = data.courses.find((c) => c.name === state.selectedCourse);
  const selectedCourseId = selectedCourseObj?.id;
  const courseAnnouncements = selectedCourseId
    ? data.announcements.filter((a) => String(a.courseId) === String(selectedCourseId))
    : [];
  const courseMaterials = selectedCourseId
    ? data.materials.filter((m) => String(m.courseId) === String(selectedCourseId))
    : [];

  if (state.courseTab === "Announcements") {
    if (!courseAnnouncements.length) {
      return `<article class="card course-tab-card"><p class="muted">No announcements yet. Admin has not posted any announcement.</p></article>`;
    }
    return courseAnnouncements
      .map(
        (a) => `
        <article class="card course-tab-card compact-item">
          <div class="split">
            <div>
              <div class="announce-header">
                <button class="announce-action ${state.announcementCommentOpen[a.id] ? "announce-action-active" : ""}" onclick="toggleAnnouncementComment('${a.id}')">💬 Comments</button>
                <button class="announce-action ${state.userScoped.savedAnnouncements[a.id] ? "announce-action-saved" : ""}" onclick="toggleAnnouncementSave('${a.id}')">${state.userScoped.savedAnnouncements[a.id] ? "🔖 Saved" : "🔖 Save"}</button>
                <h4>${a.title}</h4>
              </div>
              <small class="muted announce-meta">
                <span>${data.lecturer.name}</span>
                <span>•</span>
                <span>${a.meta}</span>
              </small>
            </div>
            <div class="lecturer-mini lecturer-chip">${data.lecturer.avatar} ${data.lecturer.name}</div>
          </div>
          <p>${a.text}</p>
          <div class="floating-comment ${state.announcementCommentOpen[a.id] ? "" : "hidden"}">
            <h5>Announcement Discussion</h5>
            <div class="comment-thread">
              <article class="comment-bubble comment-bubble-student">
                <strong>Student</strong>
                <p>Thank you, lecturer.</p>
              </article>
              ${getContentComments("announcement", a.id)
                .map(
                  (c) => `
                <article class="comment-bubble ${c.authorRole === "admin" ? "comment-bubble-lecturer" : "comment-bubble-student"}">
                  <strong>${c.authorName || "User"}</strong>
                  <p>${c.text}</p>
                  <small class="muted">${formatChatTime(c.createdAt)}</small>
                </article>`
                )
                .join("")}
            </div>
            <div class="comment-compose">
              <input type="text" placeholder="Write your comment..." value="${state.announcementCommentDrafts[a.id] || ""}" oninput="updateAnnouncementCommentDraft('${a.id}', this.value)" />
              <button class="button button-primary" onclick="postAnnouncementComment('${a.id}')">Post</button>
            </div>
          </div>
        </article>
      `
      )
      .join("");
  }

  if (state.courseTab === "Material") {
    function badgeClass(type) {
      if (type === "XLS") return "badge-xls";
      if (type === "W") return "badge-word";
      if (type === "PPT") return "badge-ppt";
      return "badge-pdf";
    }

    return `
      <div class="material-toolbar">
        <div>
          <h4>Class Materials</h4>
          <p class="muted">Materials uploaded by admin will appear here.</p>
        </div>
      </div>
      ${
        !courseMaterials.length
          ? `<article class="card course-tab-card"><p class="muted">No materials yet. Admin has not uploaded any class material.</p></article>`
          : ""
      }
      ${courseMaterials
        .map(
          (m) => `
            <article class="card course-tab-card">
              <div class="split">
                <div class="file-row">
                  <span class="file-badge ${badgeClass(m.type)}">${m.type}</span>
                  <div>
                    <strong>${m.name}</strong>
                    <p class="muted file-meta">Uploaded by ${data.lecturer.name}</p>
                  </div>
                </div>
                <button class="button button-secondary" onclick="toggleMaterial('${m.id}')">${state.materialOpen[m.id] ? "Hide details" : "View details"}</button>
              </div>
              <div class="${state.materialOpen[m.id] ? "" : "hidden"}">
                <div class="lecturer-comment">
                  <span class="lecturer-avatar">${data.lecturer.avatar}</span>
                  <div>
                    <strong>${data.lecturer.name}</strong>
                    <p class="muted">Please review this file before next class.</p>
                  </div>
                </div>
                <div class="material-file-actions">
                  <a class="button button-primary" href="${escapeHtml(resolvePublicApiUrl(m.filePath || "#"))}" target="_blank" rel="noopener noreferrer">Open File</a>
                  <a class="button button-secondary" href="${escapeHtml(resolvePublicApiUrl(m.filePath || "#"))}" download>Download</a>
                </div>
                ${commentsBlock(`${m.id}-material-comments`, "material", m.id)}
              </div>
            </article>
          `
        )
        .join("")}
    `;
  }

  return assignmentOverviewView();
}

function courseView() {
  const courses = getEffectiveCourses();
  const activeCourse = courses.find((course) => course.name === state.selectedCourse);
  const activeCourseProgress = Number(activeCourse?.progress || 0);
  const selectedCourseObj = data.courses.find((c) => c.name === state.selectedCourse);
  const sid = selectedCourseObj?.id != null ? String(selectedCourseObj.id) : null;
  const matCount = sid ? (data.materials || []).filter((m) => String(m.courseId) === sid).length : 0;
  const assignCount = sid ? (data.assignments || []).filter((a) => String(a.courseId) === sid).length : 0;
  const annCount = sid ? (data.announcements || []).filter((a) => String(a.courseId) === sid).length : 0;
  const tabs = ["Announcements", "Material", "Assignment"];
  return `
    <div class="page wide-page fixed-frame">
    ${nav()}
    <section class="course-detail-shell">
      <div class="card course-detail-header">
        <div class="split">
          <div>
            <h2>${state.selectedCourse}</h2>
            <p class="muted">Web Technology · Semester 2</p>
          </div>
          <div class="lecturer-head">
            <span class="lecturer-avatar">${data.lecturer.avatar}</span>
            <div>
              <strong>${data.lecturer.name}</strong>
              <small class="muted">Lecturer</small>
            </div>
          </div>
        </div>
      </div>
      <div class="card course-detail-main">
        <div class="course-detail-tabs">
          ${tabs
            .map(
              (tab) =>
                `<button class="nav-link ${state.courseTab === tab ? "active" : ""}" onclick="setCourseTab('${tab}')">${tab}</button>`
            )
            .join("")}
        </div>
        <div class="course-detail-kpis">
          <div class="kpi-item"><span class="kpi-label">Course Progress</span><strong>${activeCourseProgress}%</strong></div>
          <div class="kpi-item"><span class="kpi-label">Materials</span><strong>${matCount}</strong></div>
          <div class="kpi-item"><span class="kpi-label">Assignments</span><strong>${assignCount}</strong></div>
          <div class="kpi-item"><span class="kpi-label">Announcements</span><strong>${annCount}</strong></div>
        </div>
        <div class="course-detail-body">
          <aside class="course-detail-aside">
            <h4>My Courses</h4>
            ${courses
              .map(
                (course) => `
                <button class="course-pill ${state.selectedCourse === course.name ? "course-pill-active" : ""}" onclick="setCourse('${course.name}')">
                  ${course.name}
                </button>`
              )
              .join("")}
          </aside>
          <main class="course-detail-content">
            ${renderCourseTabContent()}
          </main>
        </div>
      </div>
    </section>
    </div>
  `;
}

function forumView() {
  const tags = ["All", "Web", "Programming", "Database", "Tips"];
  const posts = getFilteredForumPosts();

  return `
    <div class="page wide-page fixed-frame">
    ${nav()}
    <section class="card">
      <div class="split">
        <h2>Forum</h2>
        <button class="button button-primary" onclick="askQuestion()">${state.forumComposerOpen ? "Close Composer" : "Ask Question"}</button>
      </div>
      ${
        state.forumComposerOpen
          ? `<div class="card preview-card">
              <h4>Ask a new question</h4>
              <textarea placeholder="Type your question..." oninput="updateForumDraft(this.value)">${state.forumDraft}</textarea>
              <div class="button-row">
                <button class="button button-primary" onclick="submitForumQuestion()">Post Question</button>
                <button class="button button-secondary" onclick="askQuestion()">Cancel</button>
              </div>
            </div>`
          : ""
      }
      ${
        state.forumReplyTo
          ? `<div class="card preview-card">
              <h4>Reply to: ${(data.forum.find((p) => String(p.id) === String(state.forumReplyTo)) || {}).title || "Post"}</h4>
              <textarea placeholder="Write your reply..." oninput="updateForumReply(this.value)">${state.forumReplyDraft}</textarea>
              <div class="button-row">
                <button class="button button-primary" onclick="submitForumReply()">Submit Reply</button>
                <button class="button button-secondary" onclick="cancelForumReply()">Cancel</button>
              </div>
            </div>`
          : ""
      }
      <div class="forum-tools">
        <input id="forum-search-input" type="text" placeholder="Search question..." value="${state.forumSearch}" oninput="updateForumSearch(this.value)" />
        <select onchange="updateForumSort(this.value)">
          <option value="latest" ${state.forumSort === "latest" ? "selected" : ""}>Latest</option>
          <option value="replies" ${state.forumSort === "replies" ? "selected" : ""}>Most Replies</option>
          <option value="likes" ${state.forumSort === "likes" ? "selected" : ""}>Most Likes</option>
        </select>
      </div>
      ${
        state.forumViewingPost
          ? (() => {
              const activePost = data.forum.find((p) => String(p.id) === String(state.forumViewingPost));
              if (!activePost) return "";
              return `<div class="card preview-card forum-preview">
                <div class="split">
                  <strong>Viewing: ${activePost.title}</strong>
                  <button class="button button-secondary" onclick="state.forumViewingPost=null; render();">Close</button>
                </div>
                <p class="muted">By ${activePost.author} · ${activePost.last} · ${activePost.likes} likes · ${activePost.replies} replies</p>
                <p>${activePost.content || "No additional content."}</p>
                ${activePost.image ? `<img src="${escapeHtml(resolvePublicApiUrl(activePost.image))}" alt="${activePost.title}" class="forum-preview-image" />` : ""}
                <div class="forum-thread-replies">
                  ${(activePost.replyList || [])
                    .map(
                      (r) => `<div class="forum-thread-reply ${r.authorRole === "admin" ? "forum-thread-reply-admin" : ""}">
                    <strong>${r.authorRole === "admin" ? "[Admin] " : ""}${escapeHtml(r.authorName || "")}</strong>
                    <p>${escapeHtml(r.text || "")}</p>
                    <small class="muted">${formatChatTime(r.createdAt)}</small>
                  </div>`
                    )
                    .join("") || `<p class="muted">No replies yet.</p>`}
                </div>
              </div>`;
            })()
          : ""
      }
      <div class="tag-row">
        ${tags
          .map(
            (t) =>
              `<button class="tag-btn ${state.forumTag === t ? "active-tag" : ""}" onclick="updateForumTag('${t}')">${t}</button>`
          )
          .join("")}
      </div>
      <div id="forum-post-list">${forumPostsMarkup(posts)}</div>
    </section>
    </div>
  `;
}

function bookstoreView() {
  const filteredBooks = getFilteredBooks();
  const previewBookSafe = escapeHtml(state.previewBook || "");

  return `
    <div class="page wide-page fixed-frame">
    ${nav()}
    <section class="bookstore-layout bookstore-redesign">
      <aside class="card filter-panel bookstore-filter-panel">
        <div class="split">
          <h3>Filters</h3>
          <button class="button button-secondary" onclick="resetBookFilters()">Reset</button>
        </div>
        <div class="field">
          <label>Country</label>
          <select id="book-filter-country" onchange="setBookFilter('country', this.value)">
            <option value="" ${filterState.country === "" ? "selected" : ""}>All</option><option value="Malaysia" ${filterState.country === "Malaysia" ? "selected" : ""}>Malaysia</option><option value="Singapore" ${filterState.country === "Singapore" ? "selected" : ""}>Singapore</option><option value="Indonesia" ${filterState.country === "Indonesia" ? "selected" : ""}>Indonesia</option><option value="Thailand" ${filterState.country === "Thailand" ? "selected" : ""}>Thailand</option>
          </select>
        </div>
        <div class="field">
          <label>Area</label>
          <select id="book-filter-area" onchange="setBookFilter('area', this.value)">
            <option value="" ${filterState.area === "" ? "selected" : ""}>All</option><option value="Klang Valley" ${filterState.area === "Klang Valley" ? "selected" : ""}>Klang Valley</option><option value="Johor" ${filterState.area === "Johor" ? "selected" : ""}>Johor</option><option value="Penang" ${filterState.area === "Penang" ? "selected" : ""}>Penang</option><option value="Central" ${filterState.area === "Central" ? "selected" : ""}>Central</option><option value="Jakarta" ${filterState.area === "Jakarta" ? "selected" : ""}>Jakarta</option><option value="Bangkok" ${filterState.area === "Bangkok" ? "selected" : ""}>Bangkok</option>
          </select>
        </div>
        <div class="field">
          <label>Types of material</label>
          <select id="book-filter-type" onchange="setBookFilter('type', this.value)">
            <option value="" ${filterState.type === "" ? "selected" : ""}>All</option><option value="Book" ${filterState.type === "Book" ? "selected" : ""}>Book</option><option value="Workbook" ${filterState.type === "Workbook" ? "selected" : ""}>Workbook</option><option value="E-Book" ${filterState.type === "E-Book" ? "selected" : ""}>E-Book</option><option value="PDF Pack" ${filterState.type === "PDF Pack" ? "selected" : ""}>PDF Pack</option>
          </select>
        </div>
        <div class="field">
          <label id="book-price-range-label">Price range: RM ${state.bookFilters.minPrice} - RM ${state.bookFilters.maxPrice}</label>
          <input id="book-max-price" type="range" min="0" max="200" value="${state.bookFilters.maxPrice}" oninput="setBookFilter('maxPrice', this.value)" />
        </div>
        <div class="bookstore-hint">
          <strong>Tips</strong>
          <p class="muted">Use filters to quickly find books by location, format, and budget.</p>
        </div>
      </aside>
      <div class="card bookstore-main">
        ${
          state.previewBook
            ? `<div class="card preview-card"><div class="split"><strong>Preview: ${previewBookSafe}</strong><button class="button button-secondary" onclick="closePreview()">Close</button></div><p class="muted">This is a quick preview area. You can connect this to a real reader view later.</p></div>`
            : ""
        }
        <div class="bookstore-header">
          <div>
            <h2>Bookstore</h2>
            <p class="muted">Browse recommended books, workbooks, and resources.</p>
          </div>
          <div class="bookstore-header-actions">
            <input id="book-search-input" type="text" placeholder="Search book title..." value="${state.bookSearch}" oninput="setBookSearch(this.value)" />
            <select onchange="setBookSort(this.value)">
              <option value="featured" ${state.bookSort === "featured" ? "selected" : ""}>Sort: Featured</option>
              <option value="price-asc" ${state.bookSort === "price-asc" ? "selected" : ""}>Price: Low to High</option>
              <option value="price-desc" ${state.bookSort === "price-desc" ? "selected" : ""}>Price: High to Low</option>
            </select>
          </div>
        </div>
        <div class="bookstore-tags">
          <button class="tag-btn ${state.bookTag === "Featured" ? "active-tag" : ""}" onclick="setBookTag('Featured')">Featured</button>
          <button class="tag-btn ${state.bookTag === "Programming" ? "active-tag" : ""}" onclick="setBookTag('Programming')">Programming</button>
          <button class="tag-btn ${state.bookTag === "Web Dev" ? "active-tag" : ""}" onclick="setBookTag('Web Dev')">Web Dev</button>
          <button class="tag-btn ${state.bookTag === "Database" ? "active-tag" : ""}" onclick="setBookTag('Database')">Database</button>
        </div>
        <div id="bookstore-count" class="bookstore-count muted">${filteredBooks.length} resource(s) found</div>
        <div id="bookstore-grid-container" class="bookstore-grid">
        ${bookstoreCardsMarkup(filteredBooks)}
        </div>
      </div>
      <aside class="card cart-panel">
        <div class="split">
          <h3>Shopping Cart</h3>
          <button class="button button-secondary" onclick="clearCart()">Clear</button>
        </div>
        ${
          Object.keys(state.userScoped.cart).length === 0
            ? `<p class="muted">Your cart is empty.</p>`
            : Object.entries(state.userScoped.cart)
                .map(([title, qty]) => {
                  const book = data.books.find((b) => b.title === title);
                  const price = book ? book.price : 0;
                  return `<div class="item"><strong>${title}</strong><p class="muted">RM ${price.toFixed(2)} x ${qty}</p><div class="button-row"><button class="button button-secondary" onclick="changeCartQty('${title.replace(/'/g, "\\'")}', -1)">-</button><button class="button button-secondary" onclick="changeCartQty('${title.replace(/'/g, "\\'")}', 1)">+</button><button class="button button-secondary" onclick="removeFromCart('${title.replace(/'/g, "\\'")}')">Remove</button></div></div>`;
                })
                .join("")
        }
        <div class="cart-total">
          <strong>Total: RM ${Object.entries(state.userScoped.cart)
            .reduce((sum, [title, qty]) => {
              const book = data.books.find((b) => b.title === title);
              return sum + (book ? book.price * qty : 0);
            }, 0)
            .toFixed(2)}</strong>
        </div>
        <button class="button button-primary" onclick="checkoutCart()">Checkout</button>
      </aside>
    </section>
    </div>
  `;
}

function profileView() {
  const safeName = escapeHtml(String(state.profileDraft?.name ?? ""));
  const safeEmail = escapeHtml(String(state.profileDraft?.email ?? ""));
  const safeBio = escapeHtml(String(state.profileDraft?.bio ?? ""));
  return `
    <div class="page wide-page fixed-frame">
      ${nav()}
      <section class="profile-layout">
        <div class="card">
          <h2>Account Profile</h2>
          <p class="muted">Update your personal information and account preferences.</p>
          <div class="field">
            <label>Full Name</label>
            <input type="text" value="${safeName}" oninput="updateProfileField('name', this.value)" />
          </div>
          <div class="field">
            <label>Email</label>
            <input type="email" value="${safeEmail}" oninput="updateProfileField('email', this.value)" />
          </div>
          <div class="field">
            <label>Bio</label>
            <textarea placeholder="Tell us about yourself" oninput="updateProfileField('bio', this.value)">${safeBio}</textarea>
          </div>
          <button class="button button-primary" onclick="saveProfile()">Save Changes</button>
        </div>
        <div class="card">
          <h3>Account Settings</h3>
          <div class="field">
            <label>Language</label>
            <select onchange="updateSettingsField('language', this.value)">
              <option ${state.settingsDraft.language === "English" ? "selected" : ""}>English</option>
              <option ${state.settingsDraft.language === "Bahasa Malaysia" ? "selected" : ""}>Bahasa Malaysia</option>
            </select>
          </div>
          <div class="field">
            <label>Theme</label>
            <select onchange="updateSettingsField('theme', this.value)">
              <option ${state.settingsDraft.theme === "Light" ? "selected" : ""}>Light</option>
              <option ${state.settingsDraft.theme === "System Default" ? "selected" : ""}>System Default</option>
            </select>
          </div>
          <div class="field">
            <label>Notification preference</label>
            <select onchange="updateSettingsField('notificationPref', this.value)">
              <option ${state.settingsDraft.notificationPref === "All notifications" ? "selected" : ""}>All notifications</option>
              <option ${state.settingsDraft.notificationPref === "Important only" ? "selected" : ""}>Important only</option>
            </select>
          </div>
          <button class="button button-secondary" onclick="updateSettings()">Update Settings</button>
        </div>
      </section>
    </div>
  `;
}

function chatWidgetView() {
  if (!state.isLoggedIn || state.authRole !== "student") return "";
  return `
    <div class="chat-widget-shell">
      ${
        state.chatState.isOpen
          ? `<section class="chat-widget-panel ${state.chatState.isOpen ? "chat-widget-panel-open" : ""}">
              <div class="chat-widget-header">
                <div>
                  <strong>Support Chat</strong>
                  <small class="muted">Student ↔ Admin</small>
                </div>
                <button class="chat-widget-close" aria-label="Close chat" onclick="closeChatWidget()">×</button>
              </div>
              ${
                state.supportError
                  ? `<p class="muted">${state.supportError}</p>`
                  : ""
              }
              <div id="chat-widget-thread" class="chat-thread chat-widget-thread">
                ${
                  state.supportLoading
                    ? `<p class="muted">Loading messages...</p>`
                    : (state.chatState.messages || [])
                        .map((m) => {
                          const fromAdmin = (m.senderRole || m.role || "").toLowerCase() === "admin";
                          return `<article class="chat-msg ${fromAdmin ? "chat-msg-admin" : "chat-msg-student"}">
                            <div class="chat-msg-meta"><strong>${fromAdmin ? "Admin" : "You"}</strong><small>${formatChatTime(m.createdAt || m.timestamp)}</small></div>
                            <p>${m.message || m.text || ""}</p>
                          </article>`;
                        })
                        .join("") || `<p class="muted">No messages yet. Start the conversation with admin.</p>`
                }
              </div>
              <div class="chat-compose">
                <input id="chat-widget-input" type="text" placeholder="Write your message to admin..." value="${state.supportDraft}" oninput="updateSupportDraft(this.value)" onkeydown="chatInputKeydown(event)" />
                <button class="button button-primary" onclick="sendSupportMessage()">Send</button>
              </div>
            </section>`
          : ""
      }
      <button class="chat-widget-trigger" title="Open chat" onclick="toggleChatWidget()">
        💬
        ${
          state.chatState.unreadCount > 0
            ? `<span class="chat-widget-badge">${state.chatState.unreadCount}</span>`
            : ""
        }
      </button>
    </div>
  `;
}

function bindChatWidget() {
  if (!state.chatState.isOpen) return;
  const thread = document.getElementById("chat-widget-thread");
  if (thread) {
    thread.scrollTop = thread.scrollHeight;
  }
  const input = document.getElementById("chat-widget-input");
  if (input && document.activeElement !== input) {
    input.focus();
    input.selectionStart = input.value.length;
    input.selectionEnd = input.value.length;
  }
}

function supportView() {
  return `
    <div class="page wide-page fixed-frame">
      ${nav()}
      <section class="card">
        <h2>Support moved to floating chat</h2>
        <p class="muted">Use the bottom-right chat widget to message support from any page.</p>
      </section>
    </div>
  `;
}

function paymentView() {
  const total = Object.entries(state.userScoped.cart).reduce((sum, [title, qty]) => {
    const book = data.books.find((b) => b.title === title);
    return sum + (book ? book.price * qty : 0);
  }, 0);

  return `
    <div class="page wide-page fixed-frame">
      ${nav()}
      <section class="card payment-layout">
        <div class="payment-summary">
          <h2>Payment</h2>
          <p class="muted">Complete payment securely to finish checkout.</p>
          <div class="payment-note-row">
            <span class="category-label">Secure Checkout</span>
            <span class="muted">TLS encrypted</span>
          </div>
          <div class="item payment-order-card">
            <strong>Order Summary</strong>
            ${
              Object.keys(state.userScoped.cart).length
                ? Object.entries(state.userScoped.cart)
                    .map(([title, qty]) => `<div class="progress-row"><span>${title}</span><span>x${qty}</span></div>`)
                    .join("")
                : `<p class="muted">No items in cart. Add books before payment.</p>`
            }
            <div class="cart-total"><strong>Total: RM ${total.toFixed(2)}</strong></div>
          </div>
          <div class="payment-help card">
            <h4>Need Help?</h4>
            <p class="muted">Use sample card number 4242 4242 4242 4242 with any valid expiry/CVC for demo payments.</p>
          </div>
        </div>
        <form class="card payment-form-card" onsubmit="processPayment(event)">
          <h3>Card Details</h3>
          <div class="payment-methods">
            <span class="payment-chip">Visa</span>
            <span class="payment-chip">Mastercard</span>
            <span class="payment-chip">FPX</span>
          </div>
          <div class="field"><label>Full Name</label><input value="${state.paymentDraft.fullName}" oninput="updatePaymentField('fullName', this.value)" /></div>
          <div class="field"><label>Email</label><input value="${state.paymentDraft.email}" oninput="updatePaymentField('email', this.value)" /></div>
          <div class="field"><label>Card Number</label><input value="${state.paymentDraft.cardNumber}" oninput="updatePaymentField('cardNumber', this.value)" placeholder="4242 4242 4242 4242" /></div>
          <div class="split">
            <div class="field"><label>Expiry</label><input value="${state.paymentDraft.expiry}" oninput="updatePaymentField('expiry', this.value)" placeholder="MM/YY" /></div>
            <div class="field"><label>CVC</label><input value="${state.paymentDraft.cvc}" oninput="updatePaymentField('cvc', this.value)" placeholder="123" /></div>
          </div>
          <div class="button-row">
            <button class="button button-secondary" type="button" onclick="setPostLoginPage('bookstore')">Back</button>
            <button class="button button-primary" type="submit">Pay Now</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function toastLayer() {
  return `
    <div class="toast-wrap">
      ${state.toasts
        .map((t) => `<div class="toast toast-${t.type}"><span>${t.message}</span><button class="toast-close" onclick="dismissToast('${t.id}')">×</button></div>`)
        .join("")}
    </div>
  `;
}

function appView() {
  if (!state.isLoggedIn && state.page === "landing") {
    return `${landingView()}${toastLayer()}`;
  }
  if (!state.isLoggedIn && state.page === "auth") {
    return `${authView()}${toastLayer()}`;
  }
  if (!state.isLoggedIn && state.page === "adminAuth") {
    return `${adminAuthView()}${toastLayer()}`;
  }
  if (state.isLoggedIn && state.authRole === "admin") {
    return `${adminView()}${toastLayer()}`;
  }

  const pages = {
    home: homeView,
    courses: coursesView,
    courseDetail: courseView,
    forum: forumView,
    bookstore: bookstoreView,
    profile: profileView,
    payment: paymentView,
  };

  const pageView = pages[state.postLoginPage] || homeView;
  return `${pageView()}${chatWidgetView()}${toastLayer()}`;
}

function render() {
  document.getElementById("app").innerHTML = appView();
  bindAuthForm();
  bindAdminAuthForm();
  bindChatWidget();
  bindGlobalOutsideClickHandlers();
}

function bindGlobalOutsideClickHandlers() {
  if (globalOutsideClickBound) return;
  globalOutsideClickBound = true;
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!target) return;
    const userWrap = document.querySelector(".user-wrap");
    if (!userWrap) return;
    if (!userWrap.contains(target)) {
      const shouldCloseNotifications = !!state.notificationsOpen;
      const shouldCloseDropdown = !!state.dropdownOpen;
      if (shouldCloseNotifications || shouldCloseDropdown) {
        state.notificationsOpen = false;
        state.dropdownOpen = false;
        render();
      }
    }
  });
}

async function bootstrapApp() {
  loadSessionFromStorage();
  loadAdminStudioDrafts();
  render();
  if (state.isLoggedIn && state.authRole === "admin") {
    await refreshAdminPageData();
  } else if (state.isLoggedIn) {
    await loadUserScopedData();
    await loadStudentChat();
    setupChatPolling();
    render();
  }
}

bootstrapApp();
