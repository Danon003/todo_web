import { createRouter, createWebHistory } from 'vue-router'
import Login from "@/views/Login.vue";
import Registration from "@/views/Registration.vue";
import Profile from "@/views/Profile.vue";
import Overview from "@/views/profile/Overview.vue";
import Tasks from "@/views/profile/Tasks.vue";
import TaskDetail from "@/views/profile/TaskDetail.vue";
import Groups from "@/views/profile/Groups.vue";
import GroupDetail from "@/views/profile/GroupDetail.vue";
import Users from "@/views/profile/Users.vue";
import Calendar from "@/views/profile/Calendar.vue";
import MyGroup from "@/views/profile/my-group.vue";
import Notifications from "@/views/profile/Notifications.vue";

const routes = [
    {
        path: '/login',
        name: 'login',
        component: Login
    },
    {
        path: '/register',
        name: 'register',
        component: Registration
    },
    {
        path: '/profile',
        component: Profile,
        meta: { requiresAuth: true },
        children: [
            {
                path: '',
                name: 'profile-overview',
                component: Overview
            },
            {
                path: 'tasks',
                name: 'tasks',
                component: Tasks,
                meta: { roles: ['ROLE_STUDENT', 'ROLE_TEACHER'] }
            },
            {
                path: 'tasks/:taskId',
                name: 'task-detail',
                component: TaskDetail,
                meta: { roles: ['ROLE_STUDENT', 'ROLE_TEACHER'] }
            },
            {
                path: 'groups',
                name: 'groups',
                component: Groups,
                meta: { roles: ['ROLE_ADMIN', 'ROLE_TEACHER'] }
            },
            {
                path: 'groups/:groupId',
                name: 'group-detail',
                component: GroupDetail,
                meta: { roles: ['ROLE_ADMIN', 'ROLE_TEACHER'] }
            },
            {
                path: 'users',
                name: 'users',
                component: Users,
                meta: { roles: ['ROLE_ADMIN'] }
            },
            {
                path: 'calendar',
                name: 'calendar',
                component: Calendar,
                meta: { roles: ['ROLE_STUDENT'] }
            },
            {
                path: '/profile/my-group',
                name: 'my-group',
                component: MyGroup,
                meta: { roles: ['ROLE_STUDENT'] }
            },
            {
                path: '/profile/notifications',
                name: 'notifications',
                component: Notifications,
                meta: { requiresAuth: true, roles: ['ROLE_ADMIN', 'ROLE_TEACHER', 'ROLE_STUDENT'] }
            }
        ]
    },
    {
        path: '/',
        redirect: '/profile'
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})


export default router