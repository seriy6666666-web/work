const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? `Ошибка запроса: ${res.status}`);
  }

  return body as T;
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

  listUsers: (token: string) => request<AdminUser[]>('/users', {}, token),
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

  getCompetencyMatrix: (token: string) => request<CompetencyMatrix>('/competency-matrix', {}, token),
  setCompetency: (token: string, payload: SetCompetencyPayload) =>
    request<SetCompetencyPayload>('/competency', { method: 'PUT', body: JSON.stringify(payload) }, token),

  listDistributionOperations: (token: string) =>
    request<DistributionOperation[]>('/distribution/operations', {}, token),
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
    const res = await fetch(`${API_URL}/stats/site-ranking/export?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new ApiError(res.status, `Не удалось скачать отчёт: ${res.status}`);
    }
    return res.blob();
  },
  getPlantSummary: (token: string, period: StatsPeriod) =>
    request<PlantSummaryEntry[]>(`/stats/plant-summary?period=${period}`, {}, token),
  getSiteDetail: (token: string, siteId: string, period: StatsPeriod) =>
    request<SiteRanking>(`/stats/site-detail/${siteId}?period=${period}`, {}, token),
  getWarnings: (token: string) => request<Warnings>('/stats/warnings', {}, token),

  getAuditLog: (token: string, filters: AuditLogFilters) => {
    const params = new URLSearchParams();
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.method) params.set('method', filters.method);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    params.set('page', String(filters.page ?? 1));
    return request<AuditLogPage>(`/audit-log?${params.toString()}`, {}, token);
  },

  listProducts: (token: string) => request<Product[]>('/products', {}, token),
  createProduct: (token: string, payload: { name: string }) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(payload) }, token),
  deleteProduct: (token: string, id: string) =>
    request<void>(`/products/${id}`, { method: 'DELETE' }, token),
  addProductOperation: (token: string, productId: string, payload: CreateProductOperationPayload) =>
    request<Product>(
      `/products/${productId}/operations`,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),
  deleteProductOperation: (token: string, id: string) =>
    request<void>(`/product-operations/${id}`, { method: 'DELETE' }, token),
  createOrderFromProduct: (token: string, payload: CreateOrderFromProductPayload) =>
    request<Order>('/orders/from-product', { method: 'POST', body: JSON.stringify(payload) }, token),

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
  | 'ORDER_AT_RISK';

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

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  siteId: string | null;
  siteName: string | null;
  createdAt: string;
}

export interface CreateUserPayload {
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
  orderId: string;
  siteId: string;
  secondarySiteId: string | null;
  skillId: string;
  site: { id: string; name: string };
  secondarySite: { id: string; name: string } | null;
  skill: { id: string; name: string };
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
  siteId: string;
  secondarySiteId?: string;
  skillId: string;
}

export interface UpdateOperationPayload {
  quantity?: number;
  siteId?: string;
  secondarySiteId?: string;
  skillId?: string;
}

export interface Skill {
  id: string;
  name: string;
  createdAt: string;
}

export interface ProductOperation {
  id: string;
  sequence: number;
  skillId: string;
  siteId: string;
  secondarySiteId: string | null;
  skill: { id: string; name: string };
  site: { id: string; name: string };
  secondarySite: { id: string; name: string } | null;
}

export interface Product {
  id: string;
  name: string;
  createdAt: string;
  operations: ProductOperation[];
}

export interface CreateProductOperationPayload {
  skillId: string;
  siteId: string;
  secondarySiteId?: string;
  sequence?: number;
}

export interface CreateOrderFromProductPayload {
  productId: string;
  name?: string;
  quantity: number;
  dueDate: string;
  priority?: number;
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
  skillId: string;
  order: { id: string; name: string; priority: number; dueDate: string };
  skill: { id: string; name: string };
  secondarySite: { id: string; name: string } | null;
  assignments: Assignment[];
  hasCompetentWorker: boolean;
  totalDoneQuantity: number;
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
  userId: string;
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
    skill: { id: string; name: string };
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
  excusedCount: number;
  totalCount: number;
  defectCount: number;
  defectRate: number | null;
}

export interface SiteRanking {
  siteId: string;
  siteName: string;
  entries: SiteRankingEntry[];
  siteCompletionRate: number | null;
  siteDefectCount: number;
  siteDefectRate: number | null;
}

export interface PlantSummaryEntry {
  siteId: string;
  siteName: string;
  completionRate: number | null;
  workersCount: number;
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
