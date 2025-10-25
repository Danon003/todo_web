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
    getTasks() {
        return api.get('/task')
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
    getMyTasks() {
        return api.get('/task/my')
    },
    getMyTask(taskId) {
        return api.get(`/task/my/${taskId}`)
    },
    updateTaskStatus(taskId, status) {
        return api.post(`/task/my/${taskId}/status`, { status });
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
    getGroups() {
        return api.get('/group')
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
    getUsers() {
        return api.get('/admin/users')
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
    getUsersByRole(role) {
        return api.get(`/admin/users/by-role?role=${role}`)
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
    getStudentTasks(userId) {
        return api.get(`/task/student/${userId}`);
    },

    getStats(){
        return api.get('/admin/statistic');
    },

    getTaskComments (taskId) {
        return api.get(`/task/${taskId}/comments`)
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


    getNotification: (params) => axios.get(`${NOTIFICATION_API}/notifications`, {
        params: {
            userId: params.userId,
            limit: params?.limit || 50
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('jwt-token')}` }
    }),

    getUnreadNotifications: () => axios.get(`${NOTIFICATION_API}/notifications/unread`, {
        params: { userId: localStorage.getItem('userId') },
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

    getUnreadCount: () => axios.get(`${NOTIFICATION_API}/notifications/unread-count`, {
        params: { userId: localStorage.getItem('userId') },
        headers: { Authorization: `Bearer ${localStorage.getItem('jwt-token')}` }
    }),


    getStudentSolutionDownloadUrl(taskId) {
        return api.get(`/minio/tasks/${taskId}/solution/download`)
    }
}