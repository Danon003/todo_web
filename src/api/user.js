import api from './index'

export default {
    createGroup(data) {
        return api.post('/group', data)
    },

}