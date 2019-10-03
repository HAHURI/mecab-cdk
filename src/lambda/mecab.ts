import * as AWS from 'aws-sdk';
 
const Region = process.env.REGION!;
  
export async function handler(event: User): Promise<GreetingMessage> {
    return HelloWorldUseCase.hello(event);
}
 
export class HelloWorldUseCase {
 
    public static async hello(userInfo: User): Promise<GreetingMessage> {
        const message = HelloWorldUseCase.createMessage(userInfo);
        return message;
    }
 
    private static createMessage(userInfo: User): GreetingMessage {
        return {
            title: `hello, ${userInfo.name}`,
            description: 'my first message.',
        }
    }
}
 
export interface User {
    name: string;
}
export interface GreetingMessage {
    title: string;
    description: string;
}