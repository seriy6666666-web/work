const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }

  /** Сервер не ответил вовсе: связь пропала, а не отказал сервер. */
  get isOffline() {
    return this.status === OFFLINE_STATUS;
  }
}

/**
 * Признак «связи нет». Настоящего кода ответа тут быть не может — сервер молчит,
 * отвечать некому, поэтому берём ноль: он не пересекается ни с одним кодом HTTP.
 */
export const OFFLINE_STATUS = 0;

export const OFFLINE_MESSAGE =
  'Нет связи с сервером. Проверьте сеть и попробуйте ещё раз — введённое сохранится.';

/**
 * Обрыв связи и отказ сервера — разные беды, и делать с ними надо разное.
 *
 * `fetch` при пропавшей сети отклоняется с TypeError, а не отдаёт ответ. Раньше
 * этот TypeError уходил мимо ApiError, и на экране появлялась общая заглушка
 * вида «Не удалось сохранить отметку» — ровно та же, что и при отказе сервера.
 * Рабочий у станка по ней не мог понять, нажать ещё раз через минуту или идти к
 * начальнику участка.
 *
 * Ошибку разбора ответа сюда не заворачиваем: это не потеря связи, а сломанный
 * ответ, и прятать его под «проверьте сеть» — значит гонять человека к роутеру
 * из-за ошибки на сервере.
 */
async function fetchOrOffline(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new ApiError(OFFLINE_STATUS, OFFLINE_MESSAGE);
  }
}

/**
 * Отказ при скачивании файла. Тело здесь не разбираем — ответ двоичный, — но
 * различать «сервер лежит» и «отказано» человеку нужно ровно так же.
 */
function downloadError(res: Response, what: string): ApiError {
  const isServerDown = res.status === 502 || res.status === 503 || res.status === 504;
  return new ApiError(res.status, isServerDown ? SERVER_DOWN_MESSAGE : `${what}: ${res.status}`);
}

export const SERVER_DOWN_MESSAGE =
  'Сервер сейчас недоступен — возможно, перезапускается. ' +
  'Попробуйте через минуту, введённое сохранится.';

/**
 * Разобрать ответ и, если он неуспешен, превратить его в понятную ошибку.
 *
 * Тело не всегда наше. Когда бэкенд лежит, а прокси на ногах — а на проводной
 * заводской сети это куда более частый случай, чем настоящий обрыв, — наружу
 * уходит 502 со страницей от nginx. Раньше её пытались разобрать как JSON,
 * `JSON.parse` бросал SyntaxError мимо ApiError, и на экране появлялась общая
 * заглушка вместо объяснения. Теперь неразобранное тело просто считаем
 * отсутствующим и говорим по коду ответа.
 */
async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: { message?: string } | undefined;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }

  if (!res.ok) {
    const isServerDown = res.status === 502 || res.status === 503 || res.status === 504;
    throw new ApiError(
      res.status,
      body?.message ?? (isServerDown ? SERVER_DOWN_MESSAGE : `Ошибка запроса: ${res.status}`),
    );
  }

  return body as T;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetchOrOffline(`${API_URL}${path}`, { ...options, headers });
  return parseResponse<T>(res);
}

/**
 * Загрузка файла (multipart). Content-Type не задаём вручную — браузер сам
 * проставит boundary, иначе сервер не разберёт тело запроса.
 */
async function upload<T>(path: string, file: File, token: string): Promise<T> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetchOrOffline(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  return parseResponse<T>(res);
}

/** Пустые фильтры в query не отправляем — иначе бэкенд получит `type=` и споткнётся. */
function clean(filters: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

async function downloadCsv(path: string, token: string): Promise<Blob> {
  const res = await fetchOrOffline(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw downloadError(res, 'Не удалось скачать файл');
  return res.blob();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: (token: string) => request<CurrentUser>('/auth/me', {}, token),

  listSites: (token: string) => request<Site[]>('/sites', {}, token),
  createSite: (token: string, payload: CreateSitePayload) =>
    request<Site>('/sites', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateSite: (token: string, id: string, payload: UpdateSitePayload) =>
    request<Site>(`/sites/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteSite: (token: string, id: string) =>
    request<void>(`/sites/${id}`, { method: 'DELETE' }, token),

  listUsers: (token: string, withArchived = false) =>
    request<AdminUser[]>(`/users${withArchived ? '?withArchived=true' : ''}`, {}, token),
  createFeedback: (token: string, payload: CreateFeedbackPayload) =>
    request<Feedback>('/feedback', { method: 'POST', body: JSON.stringify(payload) }, token),
  listMyFeedback: (token: string) => request<Feedback[]>('/feedback/mine', {}, token),
  listFeedback: (token: string, filters: FeedbackFilters = {}) =>
    request<Feedback[]>(`/feedback?${new URLSearchParams(clean(filters)).toString()}`, {}, token),
  feedbackSummary: (token: string, filters: FeedbackFilters = {}) =>
    request<FeedbackSummary>(
      `/feedback/summary?${new URLSearchParams(clean(filters)).toString()}`,
      {},
      token,
    ),
  updateFeedback: (token: string, id: string, payload: { status?: FeedbackStatus; reply?: string }) =>
    request<Feedback>(`/feedback/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  exportFeedback: (token: string, filters: FeedbackFilters = {}) =>
    downloadCsv(`/feedback/export?${new URLSearchParams(clean(filters)).toString()}`, token),
  archiveUser: (token: string, id: string) =>
    request<AdminUser>(`/users/${id}/archive`, { method: 'POST' }, token),
  restoreUser: (token: string, id: string) =>
    request<AdminUser>(`/users/${id}/restore`, { method: 'POST' }, token),
  createUser: (token: string, payload: CreateUserPayload) =>
    request<AdminUser>('/users', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateUser: (token: string, id: string, payload: UpdateUserPayload) =>
    request<AdminUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteUser: (token: string, id: string) =>
    request<void>(`/users/${id}`, { method: 'DELETE' }, token),

  listOrders: (token: string) => request<Order[]>('/orders', {}, token),
  getOrder: (token: string, id: string) => request<OrderDetail>(`/orders/${id}`, {}, token),
  createOrder: (token: string, payload: CreateOrderPayload) =>
    request<Order>('/orders', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateOrder: (token: string, id: string, payload: UpdateOrderPayload) =>
    request<Order>(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteOrder: (token: string, id: string) =>
    request<void>(`/orders/${id}`, { method: 'DELETE' }, token),

  createOperation: (token: string, orderId: string, payload: CreateOperationPayload) =>
    request<Operation>(
      `/orders/${orderId}/operations`,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),
  updateOperation: (token: string, id: string, payload: UpdateOperationPayload) =>
    request<Operation>(`/operations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteOperation: (token: string, id: string) =>
    request<void>(`/operations/${id}`, { method: 'DELETE' }, token),

  listSkills: (token: string) => request<Skill[]>('/skills', {}, token),
  createSkill: (token: string, payload: CreateSkillPayload) =>
    request<Skill>('/skills', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateSkill: (token: string, id: string, payload: UpdateSkillPayload) =>
    request<Skill>(`/skills/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteSkill: (token: string, id: string) =>
    request<void>(`/skills/${id}`, { method: 'DELETE' }, token),

  listOperationTypes: (token: string, withArchived = false) =>
    request<OperationType[]>(`/operation-types${withArchived ? '?withArchived=true' : ''}`, {}, token),
  createOperationType: (token: string, payload: CreateOperationTypePayload) =>
    request<OperationType>('/operation-types', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateOperationType: (token: string, id: string, payload: UpdateOperationTypePayload) =>
    request<OperationType>(`/operation-types/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  archiveOperationType: (token: string, id: string) =>
    request<OperationType>(`/operation-types/${id}/archive`, { method: 'POST' }, token),
  restoreOperationType: (token: string, id: string) =>
    request<OperationType>(`/operation-types/${id}/restore`, { method: 'POST' }, token),
  deleteOperationType: (token: string, id: string) =>
    request<void>(`/operation-types/${id}`, { method: 'DELETE' }, token),

  getCompetencyMatrix: (token: string) => request<CompetencyMatrix>('/competency-matrix', {}, token),
  setCompetency: (token: string, payload: SetCompetencyPayload) =>
    request<SetCompetencyPayload>('/competency', { method: 'PUT', body: JSON.stringify(payload) }, token),

  listDistributionOperations: (token: string, date?: string) =>
    request<DistributionOperation[]>(`/distribution/operations${date ? `?date=${date}` : ''}`, {}, token),
  getDistributionSummary: (token: string) =>
    request<DistributionSummary>('/distribution/summary', {}, token),
  createAssignment: (token: string, payload: CreateAssignmentPayload) =>
    request<Assignment>('/assignments', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateAssignment: (token: string, id: string, payload: UpdateAssignmentPayload) =>
    request<Assignment>(`/assignments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteAssignment: (token: string, id: string) =>
    request<void>(`/assignments/${id}`, { method: 'DELETE' }, token),

  getTodayShift: (token: string) => request<Shift | null>('/attendance/today', {}, token),
  checkIn: (token: string) => request<Shift>('/attendance/check-in', { method: 'POST' }, token),
  checkOut: (token: string) => request<Shift>('/attendance/check-out', { method: 'POST' }, token),
  getAttendanceJournal: (token: string, from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return request<JournalEntry[]>(`/attendance/journal?${q.toString()}`, {}, token);
  },
  exportAttendanceJournal: async (token: string, from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const res = await fetchOrOffline(`${API_URL}/attendance/journal/export?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw downloadError(res, 'Не удалось скачать журнал');
    return res.blob();
  },

  listMyTasks: (token: string) => request<MyTask[]>('/my-tasks', {}, token),
  submitCompletion: (token: string, assignmentId: string, payload: SubmitCompletionPayload) =>
    request<MyTask>(
      `/my-tasks/${assignmentId}/completion`,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  createAbsence: (token: string, payload: CreateAbsencePayload) =>
    request<Absence>('/absences', { method: 'POST', body: JSON.stringify(payload) }, token),
  listAbsencesMine: (token: string) => request<Absence[]>('/absences/mine', {}, token),
  listAbsencesSite: (token: string) => request<Absence[]>('/absences/site', {}, token),
  deleteAbsence: (token: string, id: string) =>
    request<void>(`/absences/${id}`, { method: 'DELETE' }, token),

  listEligibleTransferUsers: (token: string) =>
    request<EligibleUser[]>('/transfers/eligible-users', {}, token),
  createTransfer: (token: string, payload: CreateTransferPayload) =>
    request<Transfer>('/transfers', { method: 'POST', body: JSON.stringify(payload) }, token),
  listTransfersIncoming: (token: string) => request<Transfer[]>('/transfers/incoming', {}, token),
  listTransfersOutgoing: (token: string) => request<Transfer[]>('/transfers/outgoing', {}, token),
  respondTransfer: (token: string, id: string, payload: RespondTransferPayload) =>
    request<Transfer>(`/transfers/${id}/respond`, { method: 'PATCH', body: JSON.stringify(payload) }, token),

  confirmReason: (token: string, completionRecordId: string, payload: ConfirmReasonPayload) =>
    request<CompletionRecord>(
      `/completion-records/${completionRecordId}/confirm`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token,
    ),

  getSiteRanking: (token: string, period: StatsPeriod) =>
    request<SiteRanking>(`/stats/site-ranking?period=${period}`, {}, token),
  exportSiteRanking: async (token: string, period: StatsPeriod) => {
    const res = await fetchOrOffline(`${API_URL}/stats/site-ranking/export?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw downloadError(res, 'Не удалось скачать отчёт');
    return res.blob();
  },
  getPlantSummary: (token: string, period: StatsPeriod) =>
    request<PlantSummaryEntry[]>(`/stats/plant-summary?period=${period}`, {}, token),
  getSiteDetail: (token: string, siteId: string, period: StatsPeriod) =>
    request<SiteRanking>(`/stats/site-detail/${siteId}?period=${period}`, {}, token),
  getWarnings: (token: string) => request<Warnings>('/stats/warnings', {}, token),
  getStatsTrends: (token: string, days = 14) =>
    request<StatsTrends>(`/stats/trends?days=${days}`, {}, token),

  getAuditLog: (token: string, filters: AuditLogFilters) => {
    const params = new URLSearchParams();
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.method) params.set('method', filters.method);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    params.set('page', String(filters.page ?? 1));
    return request<AuditLogPage>(`/audit-log?${params.toString()}`, {}, token);
  },

  listProducts: (token: string, includeArchived = false) =>
    request<Product[]>(`/products${includeArchived ? '?includeArchived=true' : ''}`, {}, token),
  createProduct: (token: string, payload: { name: string }) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(payload) }, token),
  archiveProduct: (token: string, id: string, archived: boolean) =>
    request<Product>(`/products/${id}/archive`, { method: 'PATCH', body: JSON.stringify({ archived }) }, token),
  setProductPlatforms: (token: string, id: string, platformIds: string[]) =>
    request<Product>(`/products/${id}/platforms`, { method: 'PATCH', body: JSON.stringify({ platformIds }) }, token),
  deleteProduct: (token: string, id: string) =>
    request<void>(`/products/${id}`, { method: 'DELETE' }, token),

  /** Администратор: заводит сотрудников из матрицы и получает пароли для раздачи. */
  importEmployees: (token: string, file: File, dryRun: boolean) =>
    upload<ImportReport>(`/import/employees?dryRun=${dryRun}`, file, token),
  /** Планировщик: только навыки и компетенции, учётные записи не создаются. */
  importCompetency: (token: string, file: File, dryRun: boolean) =>
    upload<ImportReport>(`/import/competency?dryRun=${dryRun}`, file, token),
  importNorms: (token: string, file: File, dryRun: boolean, defaultSite?: string) =>
    upload<ImportReport>(
      `/import/norms?dryRun=${dryRun}${defaultSite ? `&defaultSite=${encodeURIComponent(defaultSite)}` : ''}`,
      file,
      token,
    ),

  listGoals: (token: string, from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return request<GoalsView>(`/goals?${q.toString()}`, {}, token);
  },
  setGoal: (token: string, payload: SetGoalPayload) =>
    request<unknown>('/goals', { method: 'POST', body: JSON.stringify(payload) }, token),
  deleteGoal: (token: string, id: string) =>
    request<void>(`/goals/${id}`, { method: 'DELETE' }, token),

  listShiftLeads: (token: string, from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return request<ShiftLead[]>(`/shift-leads?${q.toString()}`, {}, token);
  },
  listMyShiftLeads: (token: string) => request<ShiftLead[]>('/shift-leads/me', {}, token),
  listShiftLeadCandidates: (token: string, siteId: string) =>
    request<{ id: string; fullName: string; role: Role }[]>(
      `/shift-leads/candidates?siteId=${siteId}`,
      {},
      token,
    ),
  setShiftLead: (token: string, payload: SetShiftLeadPayload) =>
    request<ShiftLead>('/shift-leads', { method: 'POST', body: JSON.stringify(payload) }, token),
  deleteShiftLead: (token: string, id: string) =>
    request<void>(`/shift-leads/${id}`, { method: 'DELETE' }, token),

  listHandovers: (token: string) => request<Handover[]>('/handovers', {}, token),
  createHandover: (token: string, payload: { message: string; toUserId?: string }) =>
    request<Handover>('/handovers', { method: 'POST', body: JSON.stringify(payload) }, token),

  listTasks: (token: string) => request<Task[]>('/tasks', {}, token),
  listAssignableForTasks: (token: string) =>
    request<{ id: string; fullName: string; role: CurrentUser['role'] }[]>('/tasks/assignable', {}, token),
  createTask: (token: string, payload: CreateTaskPayload) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(payload) }, token),
  setTaskStatus: (token: string, id: string, done: boolean) =>
    request<Task>(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ done }) }, token),
  deleteTask: (token: string, id: string) =>
    request<void>(`/tasks/${id}`, { method: 'DELETE' }, token),

  listPlatforms: (token: string) => request<Platform[]>('/platforms', {}, token),
  createPlatform: (token: string, payload: { name: string; address?: string }) =>
    request<Platform>('/platforms', { method: 'POST', body: JSON.stringify(payload) }, token),
  updatePlatform: (token: string, id: string, payload: { name?: string; address?: string | null }) =>
    request<Platform>(`/platforms/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deletePlatform: (token: string, id: string) =>
    request<void>(`/platforms/${id}`, { method: 'DELETE' }, token),
  addProductOperation: (token: string, productId: string, payload: CreateProductOperationPayload) =>
    request<Product>(
      `/products/${productId}/operations`,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),
  deleteProductOperation: (token: string, id: string) =>
    request<void>(`/product-operations/${id}`, { method: 'DELETE' }, token),
  setOperationMaterial: (token: string, productOperationId: string, materialId: string, quantityPerUnit: number) =>
    request<Product>(
      `/product-operations/${productOperationId}/materials`,
      { method: 'POST', body: JSON.stringify({ materialId, quantityPerUnit }) },
      token,
    ),
  removeOperationMaterial: (token: string, id: string) =>
    request<void>(`/operation-materials/${id}`, { method: 'DELETE' }, token),
  createOrderFromProduct: (token: string, payload: CreateOrderFromProductPayload) =>
    request<Order>('/orders/from-product', { method: 'POST', body: JSON.stringify(payload) }, token),

  getPlannedShiftsWeek: (token: string, start: string) =>
    request<PlannedShiftWeek>(`/planned-shifts/week?start=${encodeURIComponent(start)}`, {}, token),
  setPlannedShift: (token: string, payload: SetPlannedShiftPayload) =>
    request<PlannedShift>('/planned-shifts', { method: 'POST', body: JSON.stringify(payload) }, token),
  deletePlannedShift: (token: string, id: string) =>
    request<void>(`/planned-shifts/${id}`, { method: 'DELETE' }, token),

  listMaterials: (token: string) => request<Material[]>('/materials', {}, token),
  createMaterial: (token: string, payload: CreateMaterialPayload) =>
    request<Material>('/materials', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateMaterial: (token: string, id: string, payload: UpdateMaterialPayload) =>
    request<Material>(`/materials/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteMaterial: (token: string, id: string) =>
    request<void>(`/materials/${id}`, { method: 'DELETE' }, token),

  listMaterialStocks: (token: string) => request<MaterialStock[]>('/material-stocks', {}, token),
  upsertMaterialStock: (token: string, payload: UpsertStockPayload) =>
    request<MaterialStock>('/material-stocks', { method: 'POST', body: JSON.stringify(payload) }, token),
  adjustMaterialStock: (token: string, id: string, delta: number) =>
    request<MaterialStock>(`/material-stocks/${id}/adjust`, { method: 'POST', body: JSON.stringify({ delta }) }, token),
  deleteMaterialStock: (token: string, id: string) =>
    request<void>(`/material-stocks/${id}`, { method: 'DELETE' }, token),

  listEquipment: (token: string) => request<Equipment[]>('/equipment', {}, token),
  listAllEquipment: (token: string) => request<Equipment[]>('/equipment/all', {}, token),
  createEquipment: (token: string, payload: CreateEquipmentPayload) =>
    request<Equipment>('/equipment', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateEquipment: (token: string, id: string, payload: UpdateEquipmentPayload) =>
    request<Equipment>(`/equipment/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  deleteEquipment: (token: string, id: string) =>
    request<void>(`/equipment/${id}`, { method: 'DELETE' }, token),

  getNotifications: (token: string) => request<AppNotification[]>('/notifications', {}, token),
  getUnreadCount: (token: string) =>
    request<{ count: number }>('/notifications/unread-count', {}, token),
  markNotificationRead: (token: string, id: string) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }, token),
  markAllNotificationsRead: (token: string) =>
    request<{ ok: boolean }>('/notifications/read-all', { method: 'PATCH' }, token),
};

export type NotificationType =
  | 'ASSIGNMENT'
  | 'TRANSFER_REQUEST'
  | 'TRANSFER_RESPONSE'
  | 'ORDER_DONE'
  | 'ORDER_AT_RISK'
  | 'MATERIAL_LOW';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  siteId: string | null;
}

export type Role = 'ADMIN' | 'PLANNER' | 'PRODUCTION_HEAD' | 'SITE_LEAD' | 'WORKER';

export interface Site {
  id: string;
  name: string;
  createdAt: string;
}

export interface CreateSitePayload {
  name: string;
}

export interface UpdateSitePayload {
  name?: string;
}

export type FeedbackType = 'PROBLEM' | 'IDEA' | 'COMPLAINT' | 'SHIFT';
export type FeedbackMood = 'GOOD' | 'SO_SO' | 'BAD';
export type FeedbackStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';

export interface Feedback {
  id: string;
  type: FeedbackType;
  mood: FeedbackMood | null;
  message: string | null;
  screen: string | null;
  status: FeedbackStatus;
  reply: string | null;
  repliedAt: string | null;
  anonymous: boolean;
  authorId: string | null;
  authorRole: Role;
  createdAt: string;
  author?: { id: string; fullName: string } | null;
  site?: { id: string; name: string } | null;
  repliedBy?: { id: string; fullName: string } | null;
}

export interface CreateFeedbackPayload {
  type: FeedbackType;
  mood?: FeedbackMood;
  message?: string;
  screen?: string;
  anonymous?: boolean;
}

export interface FeedbackFilters {
  [key: string]: string | undefined;
  type?: string;
  status?: string;
  siteId?: string;
  from?: string;
  to?: string;
}

export interface FeedbackSummary {
  total: number;
  newCount: number;
  byType: Record<FeedbackType, number>;
  moodByDay: { date: string; good: number; soSo: number; bad: number }[];
}

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  siteId: string | null;
  siteName: string | null;
  managerId: string | null;
  managerName: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface CreateUserPayload {
  managerId?: string | null;
  username: string;
  password: string;
  fullName: string;
  role: Role;
  siteId?: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  role?: Role;
  siteId?: string;
  password?: string;
  managerId?: string | null;
}

export type OrderStatus = 'CREATED' | 'IN_PROGRESS' | 'DONE' | 'SHIPPED';

export interface Order {
  id: string;
  name: string;
  quantity: number;
  dueDate: string;
  priority: number;
  status: OrderStatus;
  createdAt: string;
  operationsCount: number;
  operationsQuantity: number;
}

export interface Operation {
  id: string;
  quantity: number;
  /** Сколько участок должен сделать за смену; null — план не задан. */
  dailyQuantity: number | null;
  orderId: string;
  siteId: string;
  secondarySiteId: string | null;
  operationTypeId: string;
  site: { id: string; name: string };
  secondarySite: { id: string; name: string } | null;
  operationType: { id: string; name: string; norm: number | null; skill: { id: string; name: string } | null };
}

export interface OrderDetail extends Omit<Order, 'operationsCount' | 'operationsQuantity'> {
  operations: Operation[];
}

export interface CreateOrderPayload {
  name: string;
  quantity: number;
  dueDate: string;
  priority?: number;
}

export interface UpdateOrderPayload {
  name?: string;
  quantity?: number;
  dueDate?: string;
  priority?: number;
  status?: OrderStatus;
}

export interface CreateOperationPayload {
  quantity: number;
  dailyQuantity?: number;
  siteId: string;
  secondarySiteId?: string;
  operationTypeId: string;
}

export interface UpdateOperationPayload {
  quantity?: number;
  dailyQuantity?: number;
  siteId?: string;
  secondarySiteId?: string;
  operationTypeId?: string;
}

export interface Skill {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * Операция справочника — что делают на производстве. Навык необязателен:
 * часть операций умеют все, и требовать для них квалификацию не нужно.
 */
export interface OperationType {
  id: string;
  name: string;
  norm: number | null;
  skillId: string | null;
  skill: { id: string; name: string } | null;
  archivedAt: string | null;
  usedInOrders?: number;
  usedInProducts?: number;
}

export interface CreateOperationTypePayload {
  name: string;
  norm?: number;
  skillId?: string;
}

export interface UpdateOperationTypePayload {
  name?: string;
  norm?: number | null;
  skillId?: string | null;
}

export interface OperationMaterial {
  id: string;
  quantityPerUnit: number;
  material: { id: string; name: string; unit: string };
}

export interface ProductOperation {
  id: string;
  sequence: number;
  operationTypeId: string;
  siteId: string;
  secondarySiteId: string | null;
  operationType: { id: string; name: string; norm: number | null; skill: { id: string; name: string } | null };
  site: { id: string; name: string };
  secondarySite: { id: string; name: string } | null;
  materials: OperationMaterial[];
}

export interface GoalRow {
  id: string;
  userId: string;
  fullName: string;
  date: string;
  targetQuantity: number;
  fact: number;
  rate: number | null;
  missReason: string | null;
}

export interface GoalsView {
  workers: { id: string; fullName: string }[];
  goals: GoalRow[];
}

export interface SetGoalPayload {
  userId: string;
  date: string;
  targetQuantity: number;
  missReason?: string | null;
}

export interface ShiftLead {
  id: string;
  date: string;
  type: ShiftType;
  user: { id: string; fullName: string };
  site: { id: string; name: string };
}

export interface SetShiftLeadPayload {
  siteId: string;
  userId: string;
  date: string;
  type: ShiftType;
}

export interface Handover {
  id: string;
  message: string;
  createdAt: string;
  site: { id: string; name: string };
  fromUser: { id: string; fullName: string };
  toUser: { id: string; fullName: string } | null;
}

export type TaskStatus = 'OPEN' | 'DONE';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
  assignee: { id: string; fullName: string; role: CurrentUser['role'] };
  createdBy: { id: string; fullName: string };
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  dueDate?: string;
  /** Не указан — задача себе. */
  assigneeId?: string;
}

export interface ImportIssue {
  sheet: string;
  row: number;
  message: string;
}

export interface ImportCredential {
  fullName: string;
  username: string;
  password: string;
}

export interface ImportReport {
  dryRun: boolean;
  summary: { label: string; value: string | number }[];
  issues: ImportIssue[];
  /** Логины и пароли созданных сотрудников — приходят один раз, сразу после импорта. */
  credentials?: ImportCredential[];
}

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

export interface Platform {
  id: string;
  name: string;
  address: string | null;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  operations: ProductOperation[];
  platforms: { id: string; name: string }[];
}

export interface CreateProductOperationPayload {
  operationTypeId: string;
  siteId: string;
  secondarySiteId?: string;
  sequence?: number;
}

export interface CreateOrderFromProductPayload {
  productId: string;
  platformId: string;
  name?: string;
  quantity: number;
  dueDate: string;
  priority?: number;
}

// Каталог материала (без остатка — остаток в MaterialStock).
export interface Material {
  id: string;
  name: string;
  unit: string;
  createdAt: string;
}

// Остаток материала в разрезе (площадка × проект).
export interface MaterialStock {
  id: string;
  quantity: number;
  lowStockThreshold: number;
  material: { id: string; name: string; unit: string };
  platform: { id: string; name: string };
  project: { id: string; name: string };
}

export interface UpsertStockPayload {
  materialId: string;
  platformId: string;
  projectId: string;
  quantity?: number;
  lowStockThreshold?: number;
}

export type ShiftType = 'DAY' | 'NIGHT';

export interface PlannedShift {
  id: string;
  userId: string;
  date: string;
  type: ShiftType;
}

export interface PlannedShiftWeek {
  weekStart: string;
  days: string[];
  workers: { id: string; fullName: string }[];
  shifts: PlannedShift[];
}

export interface SetPlannedShiftPayload {
  userId: string;
  date: string;
  type: ShiftType;
}

export interface CreateMaterialPayload {
  name: string;
  unit: string;
}

export interface UpdateMaterialPayload {
  name?: string;
  unit?: string;
}

export type EquipmentStatus = 'OPERATIONAL' | 'MAINTENANCE' | 'BROKEN';

export interface Equipment {
  id: string;
  name: string;
  status: EquipmentStatus;
  nextMaintenanceAt: string | null;
  createdAt: string;
  siteId: string;
  site?: { id: string; name: string };
}

export interface CreateEquipmentPayload {
  name: string;
  nextMaintenanceAt?: string | null;
}

export interface UpdateEquipmentPayload {
  name?: string;
  status?: EquipmentStatus;
  nextMaintenanceAt?: string | null;
}

export interface CreateSkillPayload {
  name: string;
}

export interface UpdateSkillPayload {
  name?: string;
}

export interface CompetencyMatrix {
  skills: Skill[];
  users: { id: string; fullName: string; isAbsentToday: boolean }[];
  competencies: { userId: string; skillId: string }[];
}

export interface SetCompetencyPayload {
  userId: string;
  skillId: string;
  canDo: boolean;
}

export interface Assignment {
  id: string;
  assignedQuantity: number | null;
  createdAt: string;
  operationId: string;
  userId: string;
  user: { id: string; fullName: string };
  completionRecords?: CompletionRecord[];
}

export interface DistributionOperation {
  id: string;
  quantity: number;
  siteId: string;
  secondarySiteId: string | null;
  operationTypeId: string;
  order: { id: string; name: string; priority: number; dueDate: string };
  operationType: { id: string; name: string; norm: number | null; skill: { id: string; name: string } | null };
  secondarySite: { id: string; name: string } | null;
  assignments: Assignment[];
  hasCompetentWorker: boolean;
  /** Сделано за выбранный день. */
  totalDoneQuantity: number;
  /** Сделано по операции за всё время — сколько осталось по заказу. */
  doneAllTime: number;
  /** Сколько участок должен сделать за смену; null — план не задан. */
  dailyQuantity: number | null;
  date: string;
}

export interface DistributionRosterEntry {
  userId: string;
  fullName: string;
  checkedIn: boolean;
  invited: boolean;
  absent: boolean;
  loadPercent: number | null;
}

export interface DistributionSummary {
  siteId: string;
  siteName: string;
  completionRate: number | null;
  planDone: number;
  planTotal: number;
  operationsInWork: number;
  operationsTotal: number;
  atRiskCount: number;
  roster: DistributionRosterEntry[];
}

export interface CreateAssignmentPayload {
  /** День задания. Не указан — сегодня. */
  date?: string;
  operationId: string;
  userId: string;
  assignedQuantity?: number;
}

export interface UpdateAssignmentPayload {
  assignedQuantity: number;
}

export interface Shift {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  userId: string;
}

/** Строка журнала приходов-уходов по участку. */
export interface JournalEntry {
  userId: string;
  fullName: string;
  date: string;
  checkInAt: string;
  checkOutAt: string | null;
  hours: number | null;
}

export type DowntimeReasonCode =
  | 'NO_MATERIAL'
  | 'EQUIPMENT_BREAKDOWN'
  | 'NO_ELECTRICITY'
  | 'HEALTH_ISSUE'
  | 'OTHER';

export interface CompletionRecord {
  id: string;
  doneQuantity: number | null;
  defectQuantity: number;
  doneFlag: boolean | null;
  correctionCount: number;
  recordedAt: string;
  reasonCode: DowntimeReasonCode | null;
  reasonComment: string | null;
  reasonConfirmed: boolean;
  assignmentId: string;
}

export interface MyTask {
  id: string;
  assignedQuantity: number | null;
  createdAt: string;
  operationId: string;
  userId: string;
  operation: {
    id: string;
    quantity: number;
    operationType: { id: string; name: string; norm: number | null; skill: { id: string; name: string } | null };
    order: { id: string; name: string; priority: number; dueDate: string };
  };
  completionRecord: CompletionRecord | null;
  canCorrect: boolean;
}

export interface SubmitCompletionPayload {
  doneQuantity: number;
  defectQuantity?: number;
  reasonCode?: DowntimeReasonCode;
  reasonComment?: string;
}

export interface ConfirmReasonPayload {
  reasonCode?: DowntimeReasonCode;
}

export type AbsenceType = 'SICK_LEAVE' | 'VACATION' | 'UNPAID_LEAVE';

export interface Absence {
  id: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  createdAt: string;
  userId: string;
  createdByUserId: string;
  user?: { id: string; fullName: string };
}

export interface CreateAbsencePayload {
  userId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
}

export type TransferStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Transfer {
  id: string;
  startDate: string;
  endDate: string;
  status: TransferStatus;
  createdAt: string;
  userId: string;
  fromSiteId: string;
  toSiteId: string;
  requestedByUserId: string;
  respondedByUserId: string | null;
  user: { id: string; fullName: string };
  fromSite: { id: string; name: string };
  toSite: { id: string; name: string };
}

export interface EligibleUser {
  id: string;
  fullName: string;
  site: { id: string; name: string };
}

export interface CreateTransferPayload {
  userId: string;
  toSiteId: string;
  startDate: string;
  endDate: string;
}

export interface RespondTransferPayload {
  approve: boolean;
}

export type StatsPeriod = 'shift' | 'week' | 'month';

export interface SiteRankingEntry {
  userId: string;
  fullName: string;
  completionRate: number | null;
  normRate: number | null;
  excusedCount: number;
  totalCount: number;
  defectCount: number;
  defectRate: number | null;
  reasons: string[];
}

export interface SiteRanking {
  siteId: string;
  siteName: string;
  entries: SiteRankingEntry[];
  siteCompletionRate: number | null;
  siteNormRate: number | null;
  siteDefectCount: number;
  siteDefectRate: number | null;
}

export interface PlantSummaryEntry {
  siteId: string;
  siteName: string;
  completionRate: number | null;
  normRate: number | null;
  workersCount: number;
}

export interface TrendPoint {
  date: string;
  producedGood: number;
  defects: number;
  defectRate: number | null;
}

export interface StatsTrends {
  days: number;
  points: TrendPoint[];
  totalProducedGood: number;
  totalDefects: number;
  overallDefectRate: number | null;
}

export interface OrderWarning {
  orderId: string;
  orderName: string;
  dueDate: string;
  progressRatio: number;
  timeRatio: number;
  atRisk: boolean;
}

export interface WorkerWarning {
  userId: string;
  fullName: string;
  siteName: string;
  completionRate: number | null;
  normRate: number | null;
}

export interface Warnings {
  orderWarnings: OrderWarning[];
  workerWarnings: WorkerWarning[];
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  username: string | null;
  role: Role | null;
  method: string;
  path: string;
  statusCode: number;
  body: unknown;
  createdAt: string;
}

export interface AuditLogFilters {
  userId?: string;
  method?: string;
  from?: string;
  to?: string;
  page?: number;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}
