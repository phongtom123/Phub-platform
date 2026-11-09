"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AUTH_SESSION_EVENT, getSession, type SessionUser } from "../../../../../shared/auth-client";
import { dateTime, engagementRequest as api, jsonBody, reviewStatus, surveyCanAnswer, surveyStatus,
  type Answer, type EligibleReview, type Page, type Review, type SurveyDetail, type SurveyItem } from "../../../../../shared/engagement";
import styles from "./engagement.module.css";
import { ReviewStars, StarRatingInput } from "./ReviewStars";

function SurveyForm({id,onBack,embedded=false}:{id:string;onBack:()=>void;embedded?:boolean}){
  const [detail,setDetail]=useState<SurveyDetail|null>(null),[answers,setAnswers]=useState<Record<string,Answer>>({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[version,setVersion]=useState(0),[dirty,setDirty]=useState(false);
  const request=useRef<AbortController|null>(null),key=useRef<string|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(()=>{const c=new AbortController();setLoading(true);setError("");api<SurveyDetail>(`customer/crm/surveys/${id}`,{signal:c.signal}).then(value=>{if(!c.signal.aborted){setDetail(value);setAnswers(Object.fromEntries(value.answers.map(a=>[a.ma_cau_hoi,a])));setDirty(false);}}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[id,version]);
  const available=detail&&surveyCanAnswer(detail);
  function change(qid:string,answer:Answer){setAnswers(current=>({...current,[qid]:answer}));setDirty(true);setNotice("");}
  function discard(action:()=>void){if(!busy&&(!dirty||window.confirm("Bỏ bài trả lời chưa gửi?")))action();}
  async function submit(){
    if(request.current||!available||!detail)return;
    const rows:Answer[]=[];
    for(const q of detail.questions){const a=answers[q.ma_cau_hoi],content=a?.noi_dung?.trim();
      const filled=q.loai_cau_hoi==="MOT_LUA_CHON"?Boolean(a?.ma_lua_chon):q.loai_cau_hoi==="DIEM_1_5"?Boolean(a?.diem):Boolean(content);
      if(!filled){if(q.bat_buoc){setError(`Vui lòng trả lời: ${q.noi_dung}`);return;}continue;}
      const choice=q.options.find(o=>o.ma_lua_chon===a?.ma_lua_chon);
      if(choice?.cho_phep_nhap_khac&&!content){setError(`Vui lòng nhập nội dung Khác: ${q.noi_dung}`);return;}
      rows.push({ma_cau_hoi:q.ma_cau_hoi,ma_lua_chon:q.loai_cau_hoi==="MOT_LUA_CHON"?a.ma_lua_chon:null,diem:q.loai_cau_hoi==="DIEM_1_5"?a.diem:null,noi_dung:q.loai_cau_hoi==="VAN_BAN"||choice?.cho_phep_nhap_khac?content:null});
    }
    key.current??=crypto.randomUUID();const c=new AbortController();request.current=c;setBusy(true);setError("");setNotice("");
    try{const saved=await api<SurveyDetail>(`customer/crm/surveys/${id}/submit`,{method:"POST",...jsonBody({submission_id:key.current,answers:rows}),signal:c.signal});
      if(c.signal.aborted)return;if(saved?.survey?.ma_khao_sat!==id||!saved.recipient?.hoan_thanh_luc)throw new Error("API chưa xác nhận đã nhận bài. Hãy thử lại cùng lần gửi hoặc tải lại để đối chiếu.");
      setDetail(saved);setAnswers(Object.fromEntries(saved.answers.map(a=>[a.ma_cau_hoi,a])));setDirty(false);setNotice("Đã gửi khảo sát. Cảm ơn bạn đã chia sẻ!");
    }catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:"Chưa gửi được khảo sát.");}finally{if(request.current===c){request.current=null;setBusy(false);}}
  }
  return <div className={`${styles.page} ${embedded ? styles.embedded : ''}`}><div className={styles.actions}><button disabled={busy} onClick={()=>discard(onBack)}>← Khảo sát của tôi</button><button disabled={busy} onClick={()=>discard(()=>setVersion(x=>x+1))}>Tải lại khảo sát</button></div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}{loading?<p role="status">Đang tải khảo sát…</p>:detail&&<>
      <header className={styles.card}><h1>{detail.survey.tieu_de}</h1><p className={styles.text}>{detail.survey.mo_ta}</p><p className={styles.muted}>Hạn trả lời: {dateTime(detail.survey.han_tra_loi)}</p>
        {detail.recipient?.hoan_thanh_luc?<p>Đã hoàn thành lúc {dateTime(detail.recipient.hoan_thanh_luc)}.</p>:!available&&<p>Khảo sát đã đóng hoặc hết hạn trả lời.</p>}</header>
      <form onSubmit={e=>{e.preventDefault();void submit();}} className={styles.card}><fieldset disabled={busy||!available} style={{border:0,padding:0,minWidth:0,display:"grid",gap:22}}>
        {detail.questions.map((q,index)=>{const a=answers[q.ma_cau_hoi];return <section className={styles.card} key={q.ma_cau_hoi}><h2>{index+1}. {q.noi_dung}{q.bat_buoc?" *":" (tùy chọn)"}</h2>
          {q.loai_cau_hoi==="MOT_LUA_CHON"?q.options.map(o=><div key={o.ma_lua_chon}><label className={styles.choice}><input type="radio" name={q.ma_cau_hoi} checked={a?.ma_lua_chon===o.ma_lua_chon} onChange={()=>change(q.ma_cau_hoi,{ma_cau_hoi:q.ma_cau_hoi,ma_lua_chon:o.ma_lua_chon,noi_dung:""})}/>{o.noi_dung}</label>
            {o.cho_phep_nhap_khac&&a?.ma_lua_chon===o.ma_lua_chon&&<label>Nội dung khác<textarea aria-label={`Nội dung khác câu ${index+1}`} required maxLength={4000} value={a.noi_dung??""} onChange={e=>change(q.ma_cau_hoi,{...a,noi_dung:e.target.value})}/></label>}</div>)
          :q.loai_cau_hoi==="DIEM_1_5"?(
            <div className={styles.starQuestionContainer}>
              <span className={styles.fieldLabel}>Điểm đánh giá{q.bat_buoc?" *":""}</span>
              <StarRatingInput
                value={a?.diem??null}
                onChange={point=>change(q.ma_cau_hoi,{ma_cau_hoi:q.ma_cau_hoi,diem:point})}
                disabled={busy||!available}
                ariaLabel={`Điểm câu ${index+1}`}
                required={q.bat_buoc}
              />
            </div>
          )
          :<label>Câu trả lời<textarea aria-label={`Trả lời câu ${index+1}`} required={q.bat_buoc} maxLength={4000} value={a?.noi_dung??""} onChange={e=>change(q.ma_cau_hoi,{ma_cau_hoi:q.ma_cau_hoi,noi_dung:e.target.value})}/></label>}
        </section>;})}
      </fieldset>{error&&<p role="alert" className={styles.error} style={{marginTop:12}}>{error}</p>}{available&&<button className={styles.primary} disabled={busy}>{busy?"Đang gửi…":"Gửi bài khảo sát"}</button>}</form>
    </>}
  </div>;
}

function ReviewEditor({item,onSaved,onCancel}:{item:EligibleReview;onSaved:(review:Review)=>void;onCancel:()=>void}){
  const [stars,setStars]=useState(item.so_sao??5),[content,setContent]=useState(item.noi_dung??""),[error,setError]=useState(""),[busy,setBusy]=useState(false);const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function save(){if(request.current)return;const c=new AbortController();request.current=c;setBusy(true);setError("");
    try{const saved=await api<Review>("customer/crm/reviews",{method:"POST",...jsonBody({product_id:item.ma_sp,order_id:item.ma_donhang,stars,content:content.trim(),expected_version:item.phien_ban}),signal:c.signal});
      if(c.signal.aborted)return;if(saved.ma_sp!==item.ma_sp||saved.so_sao!==stars||saved.noi_dung!==content.trim())throw new Error("API chưa xác nhận đúng nhận xét đã lưu.");onSaved(saved);
    }catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:"Chưa lưu được nhận xét.");}finally{if(request.current===c){request.current=null;setBusy(false);}}
  }
  return <form className={styles.card} onSubmit={e=>{e.preventDefault();void save();}}><h2>{item.ten_sp}</h2><p className={styles.muted}>Đơn xác minh đã mua: {item.ma_donhang}</p><p>Mỗi sản phẩm có một đánh giá của bạn, có thể sửa kể cả khi mua lại. Tên và nhận xét hiển thị ngay khi gửi. Đánh giá đã bị quản trị viên ẩn vẫn giữ ẩn khi sửa.</p>
    <fieldset disabled={busy} style={{border:0,padding:0,minWidth:0,display:"grid",gap:15}}>
      <div className={styles.starQuestionContainer}>
        <span className={styles.fieldLabel}>Số sao</span>
        <StarRatingInput
          value={stars}
          onChange={point=>setStars(point)}
          disabled={busy}
          ariaLabel="Số sao đánh giá"
          required
        />
      </div>
      <label>Nhận xét<textarea aria-label="Nội dung đánh giá" required maxLength={4000} value={content} onChange={e=>setContent(e.target.value)}/></label>
    </fieldset>
    {error&&<p className={styles.error} role="alert">{error}</p>}<div className={styles.actions}><button disabled={busy||!content.trim()} className={styles.primary}>{busy?"Đang gửi…":"Gửi đánh giá"}</button><button type="button" disabled={busy} onClick={onCancel}>Hủy</button></div>
  </form>;
}

// Used inside the authenticated account dashboard; API still verifies ownership.
export function CustomerEngagementContent({kind,embedded=false}:{kind:"surveys"|"reviews";embedded?:boolean}){
  const [page,setPage]=useState(1),[version,setVersion]=useState(0),[surveys,setSurveys]=useState<Page<SurveyItem>|null>(null),[reviews,setReviews]=useState<Page<EligibleReview>|null>(null),[selected,setSelected]=useState<string|null>(null),[review,setReview]=useState<EligibleReview|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
  useEffect(()=>{if(selected)return;const c=new AbortController();setLoading(true);setError("");
    (kind==="surveys"?api<Page<SurveyItem>>(`customer/crm/surveys?page=${page}`,{signal:c.signal}).then(value=>{if(!c.signal.aborted)setSurveys(value);}):api<Page<EligibleReview>>(`customer/crm/reviews/eligible?page=${page}`,{signal:c.signal}).then(value=>{if(!c.signal.aborted)setReviews(value);}))
      .catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[kind,page,version,selected]);
  if(selected)return <SurveyForm key={selected} id={selected} embedded={embedded} onBack={()=>{setSelected(null);setVersion(x=>x+1);}}/>;
  return <section className={`${styles.page} ${embedded ? styles.embedded : ''}`}><header className={styles.actions}><div><h1>{kind==="surveys"?"Khảo sát của tôi":"Đánh giá sản phẩm đã mua"}</h1><p className={styles.muted}>{kind==="surveys"?"Chia sẻ nhu cầu và trải nghiệm với PHUB.":"Mỗi sản phẩm chỉ có một đánh giá của bạn và có thể sửa. Chỉ áp dụng cho sản phẩm trong đơn đã hoàn thành."}</p></div>{!embedded && <Link href="/main/profile">← Tài khoản của tôi</Link>}</header>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}{loading?<p role="status">Đang tải…</p>:!error&&<>
      {kind==="surveys"?surveys?.data.length?<div className={styles.grid}>{surveys.data.map(s=><article key={s.ma_khao_sat} className={styles.card}><h2>{s.tieu_de}</h2><p>{s.mo_ta}</p><p className={styles.muted}>{s.hoan_thanh_luc?"Đã hoàn thành":Date.parse(s.han_tra_loi)<=Date.now()?"Đã hết hạn":surveyStatus[s.trang_thai]} · Hạn {dateTime(s.han_tra_loi)}</p><button onClick={()=>setSelected(s.ma_khao_sat)}>{s.hoan_thanh_luc?"Xem bài đã gửi":"Mở khảo sát"}</button></article>)}</div>:<p>Chưa có khảo sát được gửi cho bạn.</p>
      :review?<ReviewEditor key={review.ma_sp} item={review} onCancel={()=>setReview(null)} onSaved={saved=>{setReviews(current=>current&&({...current,data:current.data.map(item=>item.ma_sp===saved.ma_sp?{...item,...saved}:item)}));setReview(null);setNotice(`Đã lưu đánh giá: ${reviewStatus[saved.trang_thai]}.`);}}/>
      :reviews?.data.length?<div className={styles.grid}>{reviews.data.map(item=><article className={styles.card} key={item.ma_sp}><h2><Link href={`/main/product/${encodeURIComponent(item.ma_sp)}`}>{item.ten_sp}</Link></h2><p className={styles.muted}>Đơn xác minh đã mua: {item.ma_donhang} · {dateTime(item.thoi_gian_dat)}</p>{item.ma_danh_gia&&<><div className={styles.reviewScore}><ReviewStars value={item.so_sao ?? 0}/><span>{reviewStatus[item.trang_thai!]}</span></div><p className={styles.text}>{item.noi_dung}</p></>}<button onClick={()=>{setReview(item);setNotice("");}}>{item.ma_danh_gia?"Sửa đánh giá":"Viết đánh giá"}</button></article>)}</div>:<p>Chưa có sản phẩm trong đơn đã hoàn thành để đánh giá.</p>}
      {!review&&<div className={styles.actions}><button disabled={page===1} onClick={()=>setPage(x=>x-1)}>Trước</button><span>Trang {page}</span><button disabled={page*20>=(kind==="surveys"?surveys?.total??0:reviews?.total??0)} onClick={()=>setPage(x=>x+1)}>Sau</button><button onClick={()=>setVersion(x=>x+1)}>Làm mới</button></div>}
    </>}
  </section>;
}

export function CustomerEngagement({kind}:{kind:"surveys"|"reviews"}){
  const [user,setUser]=useState<SessionUser|null>(null),[error,setError]=useState(""),[version,setVersion]=useState(0);
  useEffect(()=>{const c=new AbortController();setUser(null);setError("");getSession(c.signal).then(value=>{if(!c.signal.aborted){if(value.role!=="KHACH_HANG")setError("Trang này dành cho tài khoản khách hàng.");else setUser(value);}}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[version]);
  useEffect(()=>{const refresh=()=>{setUser(null);setError("");setVersion(x=>x+1);};window.addEventListener(AUTH_SESSION_EVENT,refresh);return()=>window.removeEventListener(AUTH_SESSION_EVENT,refresh);},[]);
  if(!user)return <section className={styles.page}>{error?<><p role="alert" className={styles.error}>{error}</p><Link href="/auth/login">Đăng nhập</Link><button onClick={()=>setVersion(x=>x+1)}>Thử lại</button></>:<p role="status">Đang kiểm tra tài khoản…</p>}</section>;
  return <CustomerEngagementContent key={`${kind}:${user.account_id}:${version}`} kind={kind}/>;
}
