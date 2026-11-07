"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { adminFetch } from "@internal/lib/admin-fetch";
import { useAdminPolling } from "@internal/lib/use-admin-polling";
import { dateTime, engagementRequest, jsonBody, surveyStatus, type DraftQuestion, type Page, type Preview, type SurveyDetail, type SurveyDraft, type SurveyItem } from "../../../../shared/engagement";
import { useAdminAuth } from "@internal/components/admin/auth-provider";
import { SurveyStatistics } from "./survey-statistics";
import styles from "./engagement.module.css";
const api=<T,>(path:string,options?:RequestInit)=>engagementRequest<T>(path,options,adminFetch);
const question=():DraftQuestion=>({noi_dung:"",loai_cau_hoi:"MOT_LUA_CHON",nhom_noi_dung:"CHUNG",bat_buoc:true,options:[{noi_dung:"",cho_phep_nhap_khac:false},{noi_dung:"",cho_phep_nhap_khac:false}]});
const initial=():SurveyDraft=>({tieu_de:"",mo_ta:"",loai_doi_tuong:"TAT_CA",tuoi_tu:null,tuoi_den:null,han_tra_loi:new Date(Date.now()+7*86400000).toISOString(),questions:[question()]});
function draft(detail:SurveyDetail):SurveyDraft {
  const s=detail.survey;
  return {tieu_de:s.tieu_de,mo_ta:s.mo_ta,loai_doi_tuong:s.loai_doi_tuong,tuoi_tu:s.tuoi_tu,tuoi_den:s.tuoi_den,han_tra_loi:s.han_tra_loi,
    questions:detail.questions.map(q=>({noi_dung:q.noi_dung,loai_cau_hoi:q.loai_cau_hoi,nhom_noi_dung:q.nhom_noi_dung,bat_buoc:q.bat_buoc,options:q.options.map(o=>({noi_dung:o.noi_dung,cho_phep_nhap_khac:o.cho_phep_nhap_khac}))}))};
}
function localDate(value:string){const date=new Date(value);return Number.isFinite(date.getTime())?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16):"";}

function SurveyEditor({id,onClose}:{id:string|null;onClose:()=>void}) {
  const readOnly = useAdminAuth().portal === "admin";
  const [detail,setDetail]=useState<SurveyDetail|null>(null),[form,setForm]=useState<SurveyDraft>(initial),[dirty,setDirty]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(Boolean(id)),[busy,setBusy]=useState(false),[preview,setPreview]=useState<Preview|null>(null),[previewPage,setPreviewPage]=useState(1);
  const request=useRef<AbortController|null>(null),createId=useRef<string|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(()=>{if(!id)return;const controller=new AbortController();setLoading(true);
    api<SurveyDetail>(`crm/surveys/${id}`,{signal:controller.signal}).then(value=>{if(!controller.signal.aborted){setDetail(value);setForm(draft(value));}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();},[id]);
  const isDraft=!readOnly&&(!detail||detail.survey.trang_thai==="NHAP");
  function change(next:SurveyDraft){setForm(next);setDirty(true);setPreview(null);setNotice("");}
  function changeQuestion(index:number,next:DraftQuestion){change({...form,questions:form.questions.map((q,i)=>i===index?next:q)});}
  async function action(kind:"save"|"preview"|"publish"|"close",page=1){
    if(request.current)return;
    if((kind==="publish"||kind==="close")&&!window.confirm(kind==="publish"?"Phát hành và gửi khảo sát? Câu hỏi và đối tượng sẽ được chốt; hệ thống kiểm tra lại khách phù hợp khi gửi.":"Đóng khảo sát? Khách chưa gửi bài sẽ không thể trả lời tiếp."))return;
    const controller=new AbortController();request.current=controller;setBusy(true);setError("");setNotice("");
    try{
      if(kind==="save"){
        let body:unknown,path:string,method:string;
        if(detail){body={...form,expected_version:detail.survey.phien_ban};path=`crm/surveys/${detail.survey.ma_khao_sat}`;method="PUT";}
        else{createId.current??=crypto.randomUUID();body={...form,request_id:createId.current};path="crm/surveys";method="POST";}
        const saved=await api<SurveyDetail>(path,{method,...jsonBody(body),signal:controller.signal});
        if(controller.signal.aborted)return;
        if(saved?.survey?.ma_khao_sat!==(detail?.survey.ma_khao_sat??createId.current)||saved.survey.trang_thai!=="NHAP")throw new Error("API chưa xác nhận đúng khảo sát nháp.");
        setDetail(saved);setForm(draft(saved));setDirty(false);setPreview(null);setNotice("Đã lưu bản nháp. Xem trước đối tượng rồi phát hành khi sẵn sàng.");
      }else if(detail&&kind==="preview"){
        const audience=await api<Preview>(`crm/surveys/${detail.survey.ma_khao_sat}/preview?page=${page}`,{signal:controller.signal,cache:"reload"});
        if(controller.signal.aborted)return;
        if(audience.phien_ban!==detail.survey.phien_ban)throw new Error("Khảo sát đã thay đổi. Quay lại danh sách và mở lại trước khi gửi.");
        setPreview(audience);setPreviewPage(page);
      }else if(detail){
        const saved=await api<SurveyDetail>(`crm/surveys/${detail.survey.ma_khao_sat}/${kind}`,{method:"POST",...jsonBody({expected_version:detail.survey.phien_ban}),signal:controller.signal});
        if(controller.signal.aborted)return;
        if(saved?.survey?.ma_khao_sat!==detail.survey.ma_khao_sat||saved.survey.trang_thai!==(kind==="publish"?"DANG_MO":"DONG"))throw new Error("API chưa xác nhận trạng thái khảo sát.");
        setDetail(saved);setPreview(null);setNotice(kind==="publish"?"Đã phát hành khảo sát. Khách được chọn có thể xem trong Khảo sát của tôi.":"Đã đóng khảo sát, giữ nguyên kết quả.");
      }
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Không thể lưu khảo sát.");}
    finally{if(request.current===controller){request.current=null;setBusy(false);}}
  }
  function leave(){if(!busy&&(!dirty||window.confirm("Bỏ các thay đổi chưa lưu và quay lại danh sách?")))onClose();}
  if(loading)return <p role="status">Đang tải khảo sát…</p>;
  return <div className={styles.page}><div className={styles.actions}><button onClick={leave} disabled={busy}>← Danh sách khảo sát</button>{detail&&<strong>{surveyStatus[detail.survey.trang_thai]}</strong>}</div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}
    {(!id||detail)&&<form onSubmit={(e:FormEvent)=>{e.preventDefault();void action("save");}} className={styles.card}>
      <h2>{isDraft?"Soạn khảo sát":"Nội dung khảo sát đã chốt"}</h2>
      <fieldset className={styles.fields} disabled={busy||!isDraft}>
        <label>Tiêu đề<input aria-label="Tiêu đề khảo sát" required maxLength={200} value={form.tieu_de} onChange={e=>change({...form,tieu_de:e.target.value})}/></label>
        <label>Thời hạn trả lời<input aria-label="Thời hạn trả lời" required type="datetime-local" value={localDate(form.han_tra_loi)} onChange={e=>change({...form,han_tra_loi:e.target.value?new Date(e.target.value).toISOString():""})}/></label>
      </fieldset>
      <fieldset className={styles.fields} disabled={busy||!isDraft}>
        <label>Đối tượng<select aria-label="Đối tượng khảo sát" value={form.loai_doi_tuong} onChange={e=>change({...form,loai_doi_tuong:e.target.value as SurveyDraft["loai_doi_tuong"],tuoi_tu:e.target.value==="DO_TUOI"?18:null,tuoi_den:e.target.value==="DO_TUOI"?24:null})}>
          <option value="TAT_CA">Tất cả khách đang hoạt động</option><option value="DO_TUOI">Theo khoảng tuổi</option><option value="CHUA_NGAY_SINH">Chưa cung cấp ngày sinh</option></select></label>
        {form.loai_doi_tuong==="DO_TUOI"&&<><label>Từ tuổi<input aria-label="Từ tuổi" type="number" required min={0} max={130} value={form.tuoi_tu??""} onChange={e=>change({...form,tuoi_tu:e.target.value===""?null:Number(e.target.value)})}/></label>
          <label>Đến tuổi<input aria-label="Đến tuổi" type="number" required min={form.tuoi_tu??0} max={130} value={form.tuoi_den??""} onChange={e=>change({...form,tuoi_den:e.target.value===""?null:Number(e.target.value)})}/></label></>}
      </fieldset>
      <label>Mô tả<textarea disabled={busy||!isDraft} maxLength={5000} value={form.mo_ta} onChange={e=>change({...form,mo_ta:e.target.value})}/></label>
      {form.questions.map((q,index)=><fieldset disabled={busy||!isDraft} className={`${styles.card} ${styles.question}`} key={index}><legend>Câu {index+1}</legend>
        <label>Nội dung câu hỏi<input aria-label={`Nội dung câu ${index+1}`} required maxLength={1000} value={q.noi_dung} onChange={e=>changeQuestion(index,{...q,noi_dung:e.target.value})}/></label>
        <div className={styles.fields}><label>Loại câu hỏi<select aria-label={`Loại câu ${index+1}`} value={q.loai_cau_hoi} onChange={e=>changeQuestion(index,{...q,loai_cau_hoi:e.target.value as DraftQuestion["loai_cau_hoi"],options:e.target.value==="MOT_LUA_CHON"?question().options:[]})}><option value="MOT_LUA_CHON">Chọn một đáp án</option><option value="DIEM_1_5">Đánh giá điểm 1–5</option><option value="VAN_BAN">Nhập văn bản</option></select></label>
          <label>Nhóm nội dung<select value={q.nhom_noi_dung} onChange={e=>changeQuestion(index,{...q,nhom_noi_dung:e.target.value as DraftQuestion["nhom_noi_dung"]})}><option value="CHUNG">Chung</option><option value="SO_THICH">Nhu cầu / sở thích</option><option value="HAI_LONG">Mức hài lòng</option></select></label></div>
        <label className={styles.check}><input type="checkbox" checked={q.bat_buoc} onChange={e=>changeQuestion(index,{...q,bat_buoc:e.target.checked})}/>Bắt buộc trả lời</label>
        <div className={styles.options}>{q.options.map((o,oi)=><div className={styles.option} key={oi}><input aria-label={`Đáp án ${oi+1} câu ${index+1}`} required maxLength={500} value={o.noi_dung} onChange={e=>changeQuestion(index,{...q,options:q.options.map((item,i)=>i===oi?{...item,noi_dung:e.target.value}:item)})}/>
          <label className={styles.check}><input type="checkbox" aria-label={`Cho nhập Khác đáp án ${oi+1} câu ${index+1}`} checked={o.cho_phep_nhap_khac} onChange={e=>changeQuestion(index,{...q,options:q.options.map((item,i)=>({...item,cho_phep_nhap_khac:i===oi?e.target.checked:false}))})}/>Cho nhập “Khác”</label>
          <button type="button" disabled={q.options.length<=2} onClick={()=>changeQuestion(index,{...q,options:q.options.filter((_,i)=>i!==oi)})}>Bỏ đáp án</button></div>)}</div>
        {q.loai_cau_hoi==="MOT_LUA_CHON"&&<button type="button" disabled={q.options.length>=20} onClick={()=>changeQuestion(index,{...q,options:[...q.options,{noi_dung:"",cho_phep_nhap_khac:false}]})}>+ Thêm đáp án</button>}
        <div className={styles.actions}><button type="button" disabled={index===0} onClick={()=>{const next=[...form.questions];[next[index-1],next[index]]=[next[index],next[index-1]];change({...form,questions:next});}}>↑ Đưa lên</button><button type="button" disabled={form.questions.length===1} onClick={()=>change({...form,questions:form.questions.filter((_,i)=>i!==index)})}>Bỏ câu hỏi</button></div>
      </fieldset>)}
      {isDraft&&<div className={styles.actions}><button type="button" disabled={busy||form.questions.length>=30} onClick={()=>change({...form,questions:[...form.questions,question()]})}>+ Thêm câu hỏi</button><button className={styles.primary} disabled={busy}>{busy?"Đang lưu…":"Lưu bản nháp"}</button></div>}
    </form>}
    {detail&&!readOnly&&<section className={styles.card}><h2>{isDraft?"Xem trước đối tượng":"Danh sách đã gửi"}</h2><p className={styles.muted}>{isDraft?"Tuổi được tính từ ngày sinh; khách thiếu ngày sinh không thuộc khoảng tuổi. Lưu bản nháp trước khi xem đối tượng.":`Đã chốt danh sách lúc ${detail.survey.ngay_chot_doi_tuong?dateTime(detail.survey.ngay_chot_doi_tuong):"chưa phát hành"}.`}</p>
      <div className={styles.actions}><button disabled={busy||dirty} onClick={()=>void action("preview")}>{isDraft?"Xem trước khách nhận":"Xem khách đã nhận"}</button>
        {isDraft?<button className={styles.primary} disabled={busy||dirty||!preview||preview.total===0} onClick={()=>void action("publish")}>Phát hành và gửi khảo sát</button>:detail.survey.trang_thai==="DANG_MO"&&<button disabled={busy} onClick={()=>void action("close")}>Đóng khảo sát</button>}</div>
      {preview&&<><p><strong>{preview.total}</strong> khách {preview.is_snapshot?"đã nhận":"phù hợp"}</p><div className={styles.scroll}><table><thead><tr><th>Mã khách</th><th>Khách hàng</th><th>Tuổi hiện tại</th></tr></thead><tbody>{preview.data.map(c=><tr key={c.ma_kh}><td>{c.ma_kh}</td><td>{c.ten_kh}</td><td>{c.tuoi??"Chưa có thông tin"}</td></tr>)}</tbody></table></div>
        <div className={styles.actions}><button disabled={busy||previewPage===1} onClick={()=>void action("preview",previewPage-1)}>Khách trước</button><span>Trang {previewPage}</span><button disabled={busy||previewPage*20>=preview.total} onClick={()=>void action("preview",previewPage+1)}>Khách sau</button></div></>}
    </section>}
    {readOnly&&detail&&detail.survey.trang_thai!=="NHAP"&&<SurveyStatistics id={detail.survey.ma_khao_sat} version={detail.survey.phien_ban}/>}
  </div>;
}

function Workspace({initialId}:{initialId:string|null}) {
  const readOnly = useAdminAuth().portal === "admin";
  const [selected,setSelected]=useState<string|null>(initialId),[creating,setCreating]=useState(false),[page,setPage]=useState(1),[data,setData]=useState<Page<SurveyItem>|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[version,setVersion]=useState(0);
  const editing=Boolean(selected||creating);
  useEffect(()=>{if(editing)return;const controller=new AbortController();setLoading(true);setError("");
    api<Page<SurveyItem>>(`crm/surveys?page=${page}`,{signal:controller.signal,cache:version?"reload":"no-store"}).then(value=>{if(!controller.signal.aborted)setData(value);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[editing,page,version]);
  const pollError=useAdminPolling(`surveys:${page}`,!editing&&!loading&&!error,async(signal,canApply)=>{const next=await api<Page<SurveyItem>>(`crm/surveys?page=${page}`,{signal,cache:"no-cache"});if(canApply())setData(next);});
  return <section className={styles.page}><header className={styles.heading}><div><h1>{readOnly ? "Kết quả khảo sát" : "Khảo sát khách hàng"}</h1><p className={styles.muted}>Soạn câu hỏi, chọn khách theo tuổi và theo dõi phản hồi.</p></div>{!editing&&!readOnly&&<button className={styles.primary} onClick={()=>setCreating(true)}>+ Tạo khảo sát</button>}</header>
    {editing?<SurveyEditor key={selected??"new"} id={selected} onClose={()=>{setSelected(null);setCreating(false);setVersion(x=>x+1);}}/>:<>
      {error&&<p role="alert" className={styles.error}>{error}</p>}{pollError&&<p role="alert" className={styles.error}>{pollError}</p>}{loading?<p role="status">Đang tải khảo sát…</p>:data&&!error&&<section className={styles.card}>
        {data.data.length===0?<p>Chưa có khảo sát. Tạo bản nháp đầu tiên để bắt đầu.</p>:data.data.map(s=><article className={styles.card} key={s.ma_khao_sat}><div className={styles.actions}><h2>{s.tieu_de}</h2><span>{surveyStatus[s.trang_thai]}</span></div><p>{s.mo_ta}</p><p className={styles.muted}>Hạn: {dateTime(s.han_tra_loi)} · Đã gửi {s.da_gui}{readOnly&&<> · Đã trả lời {s.da_tra_loi}</>}</p><button onClick={()=>setSelected(s.ma_khao_sat)}>{readOnly ? "Xem kết quả" : "Mở khảo sát"}</button></article>)}
        <div className={styles.actions}><button disabled={page===1} onClick={()=>setPage(x=>x-1)}>Trước</button><span>{data.total} khảo sát · Trang {page}</span><button disabled={page*20>=data.total} onClick={()=>setPage(x=>x+1)}>Sau</button><button onClick={()=>setVersion(x=>x+1)}>Làm mới</button></div>
      </section>}
    </>}
  </section>;
}
export default function SurveysView(){const params=useSearchParams();return <Workspace key={params.get("id")??"main"} initialId={params.get("id")}/>;}
