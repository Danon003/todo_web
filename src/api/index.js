import axios from 'axios'


const api = axios.create({
    baseURL: 'http://localhost:8080',
    headers: {
        'Content-Type': 'application/json'
    }
})

api.interceptors.request.use(config => {
    const token = localStorage.getItem('jwt-token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type']
    }
    return config
})

const NOTIFICATION_API = 'http://localhost:8082';

export default {

    // Auth
    login(credentials) {
        return api.post('/auth/login', credentials)
    },
    register(userData) {
        return api.post('/auth/registration', userData)
    },
    forgotPassword (email)  {
        return api.post('/auth/forgot-password', {email} )
    },

    resetPassword (data)  {
        return api.post('/auth/reset-password', data)
    },

    // Tasks
    getTasks(page = 0, size = 20) {
        return api.get('/task', {
            params: { page, size }
        })
    },
    createTask(taskData) {
        return api.post('/task', taskData)
    },
    getTask(taskId) {
        return api.get(`/task/${taskId}`)
    },
    deleteTask(taskId) {
        return api.delete(`/task/${taskId}`)
    },
    getMyTasks(page = 0, size = 20) {
        return api.get('/task/my', {
            params: { page, size }
        })
    },
    getMyTask(taskId) {
        return api.get(`/task/my/${taskId}`)
    },

    shareTask(taskId, userId) {
        return api.post(`/task/my/${taskId}/share/${userId}`)
    },
    assignTaskToUser(taskId, userId) {
        return api.post(`/task/assign/${taskId}/${userId}`)
    },
    assignTaskToGroup(taskId, groupId) {
        return api.post(`/task/assign/${taskId}/group/${groupId}`, {}, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
    },
    getUsersWithTask(taskId) {
        return api.get(`/task/getListTask/${taskId}`)
    },
    getAvailableTags() {
        return api.get('/tag')
    },
    // Создать новый тег
    createTag (tagData) {
        return api.post('/tags', {tagData});
    },

    updateTask (taskId, taskData) {
        return api.put(`/task/${taskId}`, taskData)
    },

    uploadTaskFile (taskId, formData) {
        return api.post(`/minio/tasks/${taskId}/files`, formData)
    },
    getTaskFiles (taskId) {
        return api.get(`/minio/tasks/${taskId}/files`)
    },
    deleteTaskFile (taskId, fileId) {
        return api.delete(`/minio/tasks/${taskId}/files/${fileId}`)
    },
    getFileDownloadUrl(taskId, fileId) {
        return api.get(`/minio/tasks/${taskId}/files/${fileId}/download`)
    },

    // Solutions API
    getTaskSolutions (taskId) {
        return api.get(`/minio/tasks/${taskId}/solution/all`)
    },
    downloadStudentSolution (taskId, studentId) {
        return api.get(`/minio/tasks/${taskId}/solution/${studentId}/download`)
    },
    gradeSolution (taskId, studentId, data) {
        return api.put(`/minio/tasks/${taskId}/solution/${studentId}/grade`, data)
    },
    getStudentSolution(taskId) {
        return api.get(`/minio/tasks/${taskId}/solution`)
    },

// Student solutions API
    uploadStudentSolution (taskId, formData) {
        return api.post(`/minio/tasks/${taskId}/solution`, formData, {
            headers: {'Content-Type': 'multipart/form-data'}
        })
    },
    deleteStudentSolution (taskId) {
        return api.delete(`/minio/tasks/${taskId}/solution`);
    },

    // Groups
    getGroups(page = 0, size = 20) {
        return api.get('/group', {
            params: { page, size }
        })
    },
    createGroup(groupData) {
        return api.post('/group', groupData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    },
    getGroupInfo(groupId){
        return api.get(`/group/${groupId}`)
    },
    deleteGroup(groupId) {
        return api.delete(`/group/${groupId}`)
    },
    getGroupTasks(groupId){
        return api.get(`/group/${groupId}/tasks`)
    },
    getGroupStudents(groupId) {
        return api.get(`/group/${groupId}/students`)
    },
    addStudentToGroup(groupId, studentId) {
        return api.post(`/group/${groupId}/students/${studentId}`)
    },
    removeStudentFromGroup(groupId, studentId) {
        return api.delete(`/group/${groupId}/students/${studentId}`)
    },
    getGroupData(){
        return api.get('/user/my-group')
    },
    assignTeacherToGroup(id, id2) {
        return api.put(`/admin/${id}/teacher/${id2}`, {})
    },
    getTeacherName(teacherId) {
        return api.get(`/user/about-user/${teacherId}`);
    },

    // Users
    getUsers(page = 0, size = 15, sort = 'id,asc') {
        return api.get('/admin/users', {
            params: {
                page: page,
                size: size,
                sort: sort
            }
        });
    },
    createUser(userData) {
        return api.post('/admin/users', userData)
    },
    updateUserRole(userId, role) {
        return api.post(`/admin/users/${userId}/role?role=${role}`)
    },
    deleteUser(userId) {
        return api.delete(`/admin/users/${userId}/delete`)
    },
    getUsersByRole(role, page = 0, size = 15, sort = 'id,asc') {
        return api.get('/admin/users/by-role', {
            params: {
                role: role,
                page: page,
                size: size,
                sort: sort
            }
        });
    },
    getRoleAuditLog(){
        return api.get('admin/role-audit-log')
    },
    getMyUsers(){
        return api.get('/group/my-students')
    },
    getStudentsHasGroup(){
        return api.get('/group/students_has_group')
    },
    // User info
    getUserInfo() {
        return api.get('/user/me/info')
    },
    updateUserProfile(userData) {
        return api.put('/user/me/update', userData)
    },
    getStudentTasks(userId) {
        return api.get(`/task/student/${userId}`);
    },

    getStats(){
        return api.get('/admin/statistic');
    },

    getTaskComments (taskId, page = 0, size = 20) {
        return api.get(`/task/${taskId}/comments`, {
            params: { page, size }
        })
    },
    createComment (taskId, commentData) {
        return api.post(`/task/${taskId}/comments`, commentData)
    },
    updateComment (taskId, commentId, content) {
        return api.put(`/task/${taskId}/comments/${commentId}`, {content})
    },
    deleteComment (taskId, commentId) {
        return api.delete(`/task/${taskId}/comments/${commentId}`)
    },
    getCommentReplies (taskId, commentId) {
        return api.get(`/task/${taskId}/comments/${commentId}/replies`)
    },

    generateReport: (options) => {
        return api.post('/reports/generate', options, {
            responseType: 'blob'
        })
    },

    getNotification: (params) => axios.get(`${NOTIFICATION_API}/notifications`, {
        params: {
            userId: params.userId,
            page: params?.page || 0,
            size: params?.size || 15,
            sort: params?.sort || 'createdAt,desc'
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('jwt-token')}` }
    }),

    getUnreadNotifications: (params) => axios.get(`${NOTIFICATION_API}/notifications/unread`, {
        params: {
            userId: params.userId,
            page: params?.page || 0,
            size: params?.size || 15,
            sort: params?.sort || 'createdAt,desc'
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('jwt-token')}` }
    }),

    markAsReadNotification: (id) => axios.put(`${NOTIFICATION_API}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('jwt-token')}` }
    }),

    markAllAsReadNotification: (id) => axios.put(`${NOTIFICATION_API}/notifications/read-all`, {}, {
        params: { userId: id },
        headers: { Authorization: `Bearer ${localStorage.getItem('jwt-token')}` }
    }),

    deleteNotification: (id) => axios.delete(`${NOTIFICATION_API}/notifications/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('jwt-token')}` }
    }),

    getStudentSolutionDownloadUrl(taskId) {
        return api.get(`/minio/tasks/${taskId}/solution/download`)
    },

    // Video Meetings
    getVideoMeetings() {
        return api.get('/video-meetings')
    },
    createVideoMeeting(meetingData) {
        return api.post('/video-meetings', meetingData)
    },
    updateVideoMeeting(meetingId, meetingData) {
        return api.put(`/video-meetings/${meetingId}`, meetingData)
    },
    deleteVideoMeeting(meetingId) {
        return api.delete(`/video-meetings/${meetingId}`)
    },
    getVideoMeetingJoinUrl(meetingId) {
        return api.get(`/video-meetings/${meetingId}/join`)
    },
    completeVideoMeeting(meetingId) {
        return api.post(`/video-meetings/${meetingId}/complete`)
    },

    // Kanban
    getKanbanBoard(startDate, endDate) {
        return api.get('/kanban', { params: { startDate, endDate } })
    },
    moveKanbanTask(id, data) {
        return api.put(`/kanban/${id}/move`, data)
    },
    optimizeKanban(dailyLimit, bufferDays) {
        return api.post('/kanban/optimize', null, { params: { dailyLimit, bufferDays } })
    },
    applyOptimization(items) {
        return api.post('/kanban/optimize/apply', { items })
    },
    getKanbanInsights(startDate, endDate) {
        return api.get('/kanban/insights', { params: { startDate, endDate } })
    },
    whatIfKanban(minDailyLimit, maxDailyLimit, minBuffer, maxBuffer) {
        return api.get('/kanban/optimize/what-if', {
            params: { minDailyLimit, maxDailyLimit, minBuffer, maxBuffer }
        })
    },
    getKanbanWeeklyPlan(weekStart) {
        return api.get('/kanban/coach/weekly-plan', { params: { weekStart } })
    },
    // Активные задачи студента (без просроченных)
    getMyActiveTasks(page = 0, size = 20) {
        return api.get('/task/my/active', {
            params: { page, size }
        })
    },

    // Удалить все просроченные назначения студента
    deleteOverdueTasks() {
        return api.delete('/task/my/overdue')
    },

    // Студент меняет приоритет своего назначения
    updateTaskPriority(taskId, priority) {
        return api.put(`/task/my/${taskId}/priority`, { priority })
    },

    // Массовое назначение задач на группы
    bulkAssignToGroups(taskIds, groupIds) {
        return api.post('/task/assign/groups', { taskIds, groupIds })
    },

    getActiveTasks(page = 0, size = 20){
        return api.get('/task/active', {
            params: { page, size }
        })
    },

}