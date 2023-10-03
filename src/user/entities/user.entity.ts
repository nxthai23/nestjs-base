import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Exclude } from 'class-transformer';
export type UserDocument = User & Document;

@Schema()
export class User {
  _id: string;

  @Prop({ require: true, unique: true })
  username: string;

  @Prop()
  @Exclude()
  password: string;

  // add other properties here!

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}

export const UserSchema = SchemaFactory.createForClass(User);
