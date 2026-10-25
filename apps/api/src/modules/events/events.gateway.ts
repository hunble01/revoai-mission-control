import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class EventsGateway {
  @WebSocketServer() server: Server;

  emitEvent(event: any) {
    this.server.emit('activity', event);
  }

  @SubscribeMessage('ping')
  ping(@MessageBody() body: any) {
    return { type: 'pong', body };
  }
}
