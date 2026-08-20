'use client'
import {useEffect,useState} from 'react'
import {apiAssetUrl,type User} from '../lib/api'

export default function ProfileAvatar({user,size=36,className=''}:{user:User|null|undefined;size?:number;className?:string}){
 const [failed,setFailed]=useState(false),src=apiAssetUrl(user?.profileImageUrl),initial=(user?.name||user?.email||'S').charAt(0).toUpperCase()
 useEffect(()=>setFailed(false),[src])
 return <span className={`profile-avatar ${className}`} style={{width:size,height:size,fontSize:Math.max(11,Math.round(size*.34))}}>{src&&!failed?<img src={src} alt={`${user?.name||'User'} profile`} onError={()=>setFailed(true)}/>:initial}<style>{`.profile-avatar{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;overflow:hidden;border-radius:50%;background:linear-gradient(135deg,#b8935a,#8a6540);color:#fff;font-weight:700;box-shadow:0 2px 7px rgba(0,0,0,.15)}.profile-avatar img{display:block;width:100%;height:100%;object-fit:cover}`}</style></span>
}
