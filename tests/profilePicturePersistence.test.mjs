import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Employee } from '../backend/models/employeeModel.js';
import { Admin } from '../backend/models/Admin.js';
import { User } from '../backend/models/userModel.js';
import { uploadProfilePicture } from '../backend/controllers/userController.js';
const id='507f1f77bcf86cd799439011';
const req=()=>({ body:{avatar:'https://example.com/photo.png'}, user:{id,role:'employee'}, admin:{id}, organizationId:'507f1f77bcf86cd799439022' });
const response=()=>({code:0,body:null,status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('employee upload persists legacy profile despite synthetic admin and organization context',async(t)=>{
 let stored;
 const doc={_id:id,fullName:'Example Employee',async save(){stored={...this};}};
 t.mock.method(Admin,'findOne',async()=>{throw new Error('Must not update admin from employee session');});
 t.mock.method(Employee,'findOne',async(query)=>{assert.deepEqual(query,{_id:id});return doc;});
 t.mock.method(User,'findOne',async()=>null);
 const res=response();await uploadProfilePicture(req(),res);
 assert.equal(res.code,200);assert.equal(stored.profilePicture,'https://example.com/photo.png');assert.equal(stored.avatar,res.body.avatarUrl);
});
test('missing profile does not falsely report a saved picture',async(t)=>{
 t.mock.method(Employee,'findOne',async()=>null);
 const res=response();await uploadProfilePicture(req(),res);
 assert.equal(res.code,404);assert.equal(res.body.success,false);
});
test('an explicit organization mismatch is still rejected',async(t)=>{
 t.mock.method(Employee,'findOne',async()=>({_id:id,organizationId:'507f1f77bcf86cd799439033',save(){throw new Error('Must not save');}}));
 const res=response();await uploadProfilePicture(req(),res);assert.equal(res.code,403);
});
