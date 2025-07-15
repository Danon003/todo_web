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
    return config
})

export default {
    // Auth
    login(credentials) {
        return api.post('/auth/login', credentials)
    },
    register(userData) {
        return api.post('/auth/registration', userData)
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
        return api.post(`/task/my/${taskId}/status`, { status })
    },
    shareTask(taskId, userId) {
        return api.post(`/task/my/${taskId}/share/${userId}`)
    },
    assignTaskToUser(taskId, userId) {
        return api.post(`/task/assign/${taskId}/${userId}`)
    },
    assignTaskToGroup(taskId, groupId) {
        return api.post(`/task/assign/${taskId}/group/${groupId}`)
    },

    // Groups
    getGroups() {
        return api.get('/group')
    },
    createGroup(groupData) {
        return api.post('/group', groupData)
    },
    deleteGroup(groupId) {
        return api.delete(`/group/${groupId}`)
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

    // Users
    getUsers() {
        return api.get('/admin/users')
    },
    createUser(userData) {
        return api.post('/admin/users', userData)
    },
    updateUserRole(userId, role) {
        return api.post(`/admin/users/${userId}/role`, { role })
    },
    deleteUser(userId) {
        return api.delete(`/admin/users/${userId}/delete`)
    },
    getUsersByRole(role) {
        return api.get(`/admin/users/by-role?role=${role}`)
    },

    // User info
    getUserInfo() {
        return api.get('/user/me/info')
    }
}