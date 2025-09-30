import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

class NotificationWebSocket {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    connect(userId, onNotification) {
        if (this.isConnected) {
            console.log('WebSocket уже подключен');
            return;
        }

        const socket = new SockJS('http://localhost:8082/ws-notifications');
        this.client = new Client({
            webSocketFactory: () => socket,
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,

            onConnect: () => {
                this.isConnected = true;
                console.log('WebSocket подключен к серверу уведомлений');

                // Подписываемся на уведомления для конкретного пользователя
                this.client.subscribe(`/topic/user/${userId}/notifications`, (message) => {
                    try {
                        const notification = JSON.parse(message.body);
                        console.log('Получено уведомление:', notification);
                        onNotification(notification);
                    } catch (error) {
                        console.error('Ошибка парсинга уведомления:', error);
                    }
                });
            },

            onDisconnect: () => {
                this.isConnected = false;
                console.log('WebSocket отключен');
            },

            onStompError: (error) => {
                console.error('Ошибка STOMP:', error);
            }
        });

        this.client.activate();
    }

    disconnect() {
        if (this.client) {
            this.client.deactivate();
            this.isConnected = false;
        }
    }

    isConnected() {
        return this.isConnected;
    }
}

export default new NotificationWebSocket();