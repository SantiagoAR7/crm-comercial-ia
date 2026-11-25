export async function sendRecoveryMail({to,subject,text}){
 const tenant=process.env.MICROSOFT_TENANT_ID,client=process.env.MICROSOFT_CLIENT_ID,secret=process.env.MICROSOFT_CLIENT_SECRET,mailbox=process.env.MICROSOFT_MAILBOX||process.env.EMAIL_FROM_ADDRESS;
 if(!tenant||!client||!secret||!mailbox)throw Error('Correo de recuperación no configurado.');
 const tokenResponse=await fetch('https://login.microsoftonline.com/'+encodeURIComponent(tenant)+'/oauth2/v2.0/token',{method:'POST',body:new URLSearchParams({client_id:client,client_secret:secret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}),signal:AbortSignal.timeout(15000)});
 if(!tokenResponse.ok)throw Error('No se pudo autenticar el envío de recuperación.');const token=await tokenResponse.json();
 const response=await fetch('https://graph.microsoft.com/v1.0/users/'+encodeURIComponent(mailbox)+'/sendMail',{method:'POST',headers:{authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({message:{subject,body:{contentType:'Text',content:text},toRecipients:[{emailAddress:{address:to}}]},saveToSentItems:true}),signal:AbortSignal.timeout(20000)});
 if(response.status!==202)throw Error('No se pudo enviar el correo de recuperación.');
}
