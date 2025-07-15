<template>
  <div class="groups-container">
    <div class="groups-header">
      <h2>{{ user.role === 'ROLE_ADMIN' ? 'Управление группами' : 'Мои группы' }}</h2>
      <button v-if="user.role === 'ROLE_ADMIN'" @click="showCreateModal = true" class="create-btn">
        Создать группу
      </button>
    </div>

    <div class="groups-list">
      <div v-for="group in groups" :key="group.id" class="group-card">
        <h3>{{ group.name }}</h3>
        <p>{{ group.description }}</p>
        <div class="group-meta">
          <span>Студентов: {{ studentCount(group.id) }}</span>
        </div>
        <div class="group-actions">
          <button @click="viewGroup(group.id)" class="action-btn view">Просмотр</button>
          <button v-if="user.role === 'ROLE_ADMIN'"
                  @click="deleteGroup(group.id)"
                  class="action-btn delete">
            Удалить
          </button>
        </div>
      </div>
    </div>

    <!-- Модальное окно создания группы -->
    <div v-if="showCreateModal" class="modal">
      <div class="modal-content">
        <span class="close" @click="showCreateModal = false">&times;</span>
        <h3>Создать новую группу</h3>
        <form @submit.prevent="createGroup">
          <div class="form-group">
            <label>Название:</label>
            <input v-model="newGroup.name" type="text" required>
          </div>
          <div class="form-group">
            <label>Описание:</label>
            <textarea v-model="newGroup.description"></textarea>
          </div>
          <button type="submit" class="submit-btn">Создать</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted} from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';

export default {
  name: 'Groups',
  setup() {
    const router = useRouter();
    const groups = ref([]);
    const studentsByGroup = ref({}); // Храним студентов по ID группы
    const showCreateModal = ref(false);
    const newGroup = ref({
      name: '',
      description: ''
    });
    const user = JSON.parse(localStorage.getItem('user') || {});

    // Получаем список всех групп
    const fetchGroups = async () => {
      try {
        const token = localStorage.getItem('jwt-token');
        const response = await axios.get('http://localhost:8080/group', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        groups.value = response.data;

        // Для каждой группы загружаем студентов и задачи
        groups.value.forEach(group => {
          fetchStudentsForGroup(group.id);
        });
      } catch (error) {
        console.error('Ошибка при получении групп:', error);
      }
    };

    // Получаем студентов для конкретной группы
    const fetchStudentsForGroup = async (groupId) => {
      try {
        const token = localStorage.getItem('jwt-token');
        const response = await axios.get(
            `http://localhost:8080/group/${groupId}/students`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
        );

        // Сохраняем студентов в объект по ID группы
        studentsByGroup.value = {
          ...studentsByGroup.value,
          [groupId]: response.data
        };
      } catch (error) {
        console.error(`Ошибка при получении студентов группы ${groupId}:`, error);
        studentsByGroup.value = {
          ...studentsByGroup.value,
          [groupId]: []
        };
      }
    };

    // Вычисляем количество студентов для группы
    const studentCount = (groupId) => {
      return studentsByGroup.value[groupId]?.length || 0;
    };

    onMounted(fetchGroups);

    const viewGroup = (groupId) => {
      router.push(`/profile/groups/${groupId}`);
    };

    const createGroup = async () => {
      try {
        const token = localStorage.getItem('jwt-token');
        const params = new URLSearchParams();
        params.append('name', newGroup.value.name);
        params.append('description', newGroup.value.description);

        await axios.post(`http://localhost:8080/group?${params.toString()}`, null, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        showCreateModal.value = false;
        await fetchGroups();
        newGroup.value = {
          name: '',
          description: ''
        };
      } catch (error) {
        console.error('Ошибка при создании группы:', error);
        if (error.response && error.response.status === 403) {
          alert('У вас нет прав для создания групп');
        } else {
          alert('Произошла ошибка при создании группы');
        }
      }
    };

    const deleteGroup = async (groupId) => {
      try {
        const token = localStorage.getItem('jwt-token');
        await axios.delete(`http://localhost:8080/group/${groupId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        await fetchGroups();
      } catch (error) {
        console.error('Ошибка при удалении группы:', error);
      }
    };

    return {
      groups,
      showCreateModal,
      newGroup,
      user,
      studentCount,
      viewGroup,
      createGroup,
      deleteGroup
    };
  }
};
</script>

<style scoped>
.groups-container {
  padding: 20px;
}

.groups-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.create-btn {
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.groups-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.group-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.group-meta {
  display: flex;
  justify-content: space-between;
  margin: 10px 0;
  font-size: 0.9em;
  color: #666;
}

.group-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.view {
  background-color: #17A2B8;
  color: white;
}

.delete {
  background-color: #DC3545;
  color: white;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 500px;
  max-width: 90%;
}

.close {
  float: right;
  font-size: 24px;
  cursor: pointer;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-group textarea {
  min-height: 100px;
}

.submit-btn {
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>