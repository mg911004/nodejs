//const { response } = require('express');
const express = require('express'); //express를 설치했기 때문에 가져올 수 있다..
const app = express();
const port = 8001;

const mysql = require("mysql2/promise"); //mysql 연동
const dbConfig = require('./dbConfig.js'); //db 계정 정보

const cors = require('cors'); //post 요청받을시 cors에러 해결을 위한 라이브러리
const cookieParser = require('cookie-parser');
const session = require("express-session"); //세션모듈 가져오기
const multer = require('multer'); //이미지 업로드 모듈
const moment = require('moment'); //날짜 관련 포맷 모듈

const Pusher = require('pusher'); //채팅모듈등록
const pusher = new Pusher({ //채팅출력정보
    appId: "1343117",
    key: "407cb2ae1ebb455e1244",
    secret: "6d107d2c9d093dad06be",
    cluster: "ap3",
    useTLS: true
});

app.use(cors());
app.use(express.json()); //express.js의 내장 body-parser적용 (req.body로 데이터 받을수 있음)
app.use(express.urlencoded( {extended : true } )); //extende : true -> qs 라이브러리 사용
app.use(cookieParser());
app.use(express.static('public')); //정적 파일 접근을 위해 사용 (업로드 되어진 이미지 보여주는 용도)
app.use(session({
	secret: 'session_cookie_name',
	resave: false,
	saveUninitialized: true
}));



//oracledb.autoCommit = true; // Oracle Auto Commit 설정  (제어어 COMMIT)

//이미지 업로드 모듈
const upload = multer({
    storage: multer.diskStorage({      
      destination: function (req, file, cb) { //저장경로
        cb(null, 'public');
      },
      filename: function (req, file, cb) { //저장될 이미지파일 이름
        cb(null, moment().valueOf() + file.originalname.replace(/(\s*)/g,"")); //repalce -> 이미지파일 이름 띄어쓰기 제거
      },
    }),
});


app.get('/', (req, res) => {
    res.send("404 not found");
})

//회원가입
app.post('/join', async(req, res) => {
    let connection;
    let rs = {};
    try {     
        connection = await mysql.createConnection(dbConfig);

        const id = req.body.id;
        const nickname = req.body.nickname;
        const pwd = req.body.pwd;
        const reg_date = moment().format('YYYY-MM-DD HH:mm:ss');

        const [result] = await connection.query(`SELECT * FROM member WHERE id ='${id}'`);

        if(result.length){
            rs.code = 501;
            rs.msg = "사용중인 아이디가 있습니다.";          
            res.send(rs);
            return;
        }else{ 
            await connection.query(`
                INSERT INTO member(
                    id, nickname, pwd , reg_date
                )VALUES (
                    '${id}',
                    '${nickname}',
                    '${pwd}',
                    '${reg_date}'
                )
            `)
            req.session.user_id = id;
            rs.ssid = req.session.user_id;     
            rs.ssnickname = nickname;        
            rs.code = 200;    
            res.send(rs);    
        }

    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//////////////////////////////////////////////////////

//로그인
app.post('/login', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const id = req.body.id;
        const pwd = req.body.pwd;

        const [result] = await connection.query(`SELECT * FROM member WHERE id ='${id}' and pwd = '${pwd}'`);

        if(result.length){
            req.session.user_id = id;
            rs.ssid = req.session.user_id;  
            rs.ssnickname = result[0].nickname;              
            rs.code = 200;    
            res.send(rs);  
        }else{ 
            rs.code = 501;       
            res.send(rs);
            return;  
        }

    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//로그아웃
app.post('/logout', async(req, res) => {
    req.session.destroy((err) => {
        if(err) {
          console.log(err);
        }
        let rs = {};
        rs.code = 200;
        res.send(rs);
    })
});

//이미지 업로드 (upload : multer모듈로 이미지 저장)
app.post('/upload',upload.single('img'),(req,res) => {
    let rs={};
    rs.code=200;
    rs.file=req.file; //저장된 이미지 파일 이름 리턴
    res.send(rs);
})

//글 등록
app.post('/write', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const id = req.body.id;
        const nickname = req.body.nickname;
        const category = req.body.category;
        const subject = req.body.subject;
        const content = req.body.content;
        const file = req.body.file;
        const reg_date = moment().format('YYYY-MM-DD HH:mm:ss');

        await connection.query(`
            INSERT INTO board(
                id, nickname, category, subject, content, file, reg_date
            )VALUES (
                '${id}',
                '${nickname}',
                '${category}',
                '${subject}',
                '${content}',
                '${file}',
                '${reg_date}',
            )`
        );  
             
        const [result] = await connection.query(`SELECT bd_no FROM board WHERE id='${id}' and subject='${subject}' and content='${content}' limit 1`);
    
        rs.bd_no=result[0].bd_no;
        rs.code = 200;    
        res.send(rs);   

    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//글 수정
app.post('/modify', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const bd_no = req.body.bd_no;
        const id = req.body.id;
        const nickname = req.body.nickname;
        const category = req.body.category;
        const subject = req.body.subject;
        const content = req.body.content;
        const file = req.body.file;
        const reg_date = moment().format('YYYY-MM-DD HH:mm:ss');

        await connection.query(`
            UPDATE board SET 
                nickname='${nickname}',
                category='${category}',
                subject='${subject}',
                content='${content}',
                file='${file}',
                reg_date='${reg_date}'
            WHERE bd_no =${bd_no} and id='${id}'
        `);

        rs.code = 200;    
        res.send(rs);      
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//글 삭제
app.post('/delete', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const id = req.body.id;
        const bd_no = req.body.bd_no;

        await connection.query(`DELETE FROM board WHERE bd_no=${bd_no} and id='${id}'`);
        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//글 목록
app.post('/boardList', async(req, res) => {

    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const category = req.body.category;
        const page = req.body.page;
        const sort = req.body.sort;
        const listNumber = req.body.listNumber; //한 화면에 보여줄 데이터 수

        //페이징관련
        const startNum = page*listNumber-listNumber; // 페이징 시작넘버
        const paging = `limit ${startNum},${listNumber}`;

        //필터적용
        let filter="";
        filter = `hide=0 and category='${category}'`;
        if(sort=="hot"){ //인기
            filter+=` ORDER BY hits DESC,reg_date DESC`;
        }else if(sort=="latest"){ //최신
            filter+=` ORDER BY reg_date DESC`;
        }else if(sort=="ten"){ //10추
            filter+=` and gets>=10 ORDER BY gets DESC`;
        }
        //

        const [result] = await connection.query(`SELECT * from board where ${filter} ${paging}`); 
        //총 데이터 개수
        const [data_cnt] = await connection.query(`SELECT count(*) as cnt FROM board WHERE ${filter}`); 

        rs.code = 200;    
        rs.dbo = result;
        rs.data_cnt = data_cnt[0].cnt;
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};    
        res.send(rs);
        return;
    }
});

//해당 글 정보
app.post('/boardView', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const bd_no = req.body.bd_no;
        const id = req.body.id;

        //해당 글 정보
        const [result] = await connection.query(`SELECT * FROM board WHERE bd_no=${bd_no}`);

        //댓글 정보
        const [reply] = await connection.query(`SELECT * FROM reply WHERE bd_no=${bd_no} and hide=0`);

        //계정 기준 유저아이디 추천,비추천 개수
        const [id_recomm] = await connection.query(`SELECT count(*) as cnt FROM recommend WHERE bd_no=${bd_no} and id='${id}'`);

        //즐겨찾기 유무 체크
        const [bookmark] = await connection.query(`SELECT count(*) as cnt FROM bookmark WHERE bd_no=${bd_no} and id='${id}'`);
          
        rs.code = 200;    
        rs.dbo = result[0];  
        rs.reply = reply;
        rs.id_recomm = id_recomm[0].cnt;
        rs.bookmark = bookmark[0].cnt;
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//추천,비추천
app.post('/recommend', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const id = req.body.id;
        const bd_no = req.body.bd_no;
        const classtype = req.body.classtype;
        const reg_date = moment().format('YYYY-MM-DD HH:mm:ss');

        await connection.query(
            `INSERT INTO recommend (  
                bd_no,
                id,
                classtype,
                reg_date
            ) VALUES(
                ${bd_no},
                '${id}',
                '${classtype}',
                '${reg_date}'
            )`
        )

        //해당 글의 추천or비추천 갯수 가져오기
        const [rec_cnt] = await connection.query(`SELECT count(*) as cnt FROM recommend WHERE bd_no=${bd_no} and classtype='${classtype}'`); 

        //board 테이블 추천or비추천 업데이트
        if(classtype=="추천"){
            await connection.query(`UPDATE board SET gets=${rec_cnt[0].cnt} WHERE bd_no =${bd_no}`);
        }else{
            await connection.query(`UPDATE board SET degets=${rec_cnt[0].cnt} WHERE bd_no =${bd_no}`);
        }

        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//즐겨찾기 등록
app.post('/bookmark_ins', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const id = req.body.id;
        const bd_no = req.body.bd_no;
        const reg_date = moment().format('YYYY-MM-DD HH:mm:ss');

        await connection.query(
            `INSERT INTO bookmark (  
                bd_no,
                id,
                reg_date
            ) VALUES(
                ${bd_no},
                '${id}',
                '${reg_date}'
            )`
        )
        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//즐겨찾기 삭제
app.post('/bookmark_del', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const id = req.body.id;
        const bd_no = req.body.bd_no;

        await connection.query(` DELETE FROM bookmark WHERE bd_no=${bd_no} and id='${id}'`)
        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//댓글 등록
app.post('/reply_ins', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const id = req.body.id;
        const nickname = req.body.nickname;
        const bd_no = req.body.bd_no;
        const content = req.body.content;
        const reg_date = moment().format('YYYY-MM-DD HH:mm:ss');

        await connection.query(
            `INSERT INTO reply (  
                bd_no,
                id,
                nickname,
                content,
                reg_date
            ) VALUES(
                ${bd_no},
                '${id}',
                '${nickname}',
                '${content}',
                '${reg_date}'
            )`
        )

        //댓글 갯수 가져오기
        const [rc_cnt] = await connection.query(`SELECT count(*) as cnt FROM reply WHERE hide=0 and bd_no=${bd_no}`); 
        //board 테이블 댓글수 업데이트
        await connection.query(`UPDATE board SET comments=${rc_cnt[0].cnt} WHERE bd_no =${bd_no}`);

        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//댓글 삭제
app.post('/reply_del', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const rp_no = req.body.rp_no;
        const bd_no = req.body.bd_no;

        await connection.query(
            `UPDATE reply SET hide=1 where rp_no = ${rp_no}`
        )

        //댓글 갯수 가져오기
        const [rc_cnt] = await connection.query(`SELECT count(*) as cnt from reply WHERE hide=0 and bd_no=${bd_no}`); 
        //board 테이블 댓글수 업데이트
        await connection.query(`UPDATE board SET comments=${rc_cnt[0].cnt} WHERE bd_no =${bd_no}`);

        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//조회수 증가
app.post('/hitsUp', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const id = req.body.id;
        const bd_no = req.body.bd_no;
        const ip = req.body.ip;
        const reg_date = moment().format('YYYY-MM-DD HH:mm:ss');

        await connection.query(
            `INSERT INTO hits (  
                bd_no,
                id,
                ip,
                reg_date
            ) VALUES(
                ${bd_no},
                '${id}',
                '${ip}',
                '${reg_date}'
            )`
        )

        //조회테이블 에서 갯수 가져오기
        const [hits_cnt] = await connection.query(`SELECT count(*) as cnt from hits WHERE bd_no=${bd_no}`); 
        //board 테이블 조회수 업데이트
        await connection.query(`UPDATE board SET hits=${hits_cnt[0].cnt} WHERE bd_no =${bd_no}`);

        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//내가 쓴 글 리스트
app.post('/myWrite', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const page = req.body.page;
        const id = req.body.id;
        const listNumber = req.body.listNumber; //한 화면에 보여줄 데이터 수

        //페이징관련
        const startNum = page*listNumber-listNumber; // 페이징 시작넘버
        const paging = `limit ${startNum},${listNumber}`;

        //필터적용
        let filter="";
        filter = `hide=0 and id='${id}'`;
        filter+=` ORDER BY reg_date DESC`;

        const [result] = await connection.query(`SELECT * from board where ${filter} ${paging}`); 
        //총 데이터 개수
        const [data_cnt] = await connection.query(`SELECT count(*) as cnt FROM board WHERE ${filter}`); 

        rs.code = 200;    
        rs.dbo = result;
        rs.data_cnt = data_cnt[0].cnt;
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//즐겨찾기 리스트
app.post('/myBookmark', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);
        

        const page = req.body.page;
        const id = req.body.id;
        const listNumber = req.body.listNumber; //한 화면에 보여줄 데이터 수

        //페이징관련
        const startNum = page*listNumber-listNumber; // 페이징 시작넘버
        const paging = `limit ${startNum},${listNumber}`;

        let bdno = "";

        //와드 박은 데이터 갯수 가져오기
        const [bookmark_cnt] = await connection.query(`SELECT distinct count(bd_no) as cnt from bookmark where id='${id}'`);
        //와드 박은 데이터 id_no 가져오기
        const [bookmark_bd_no] = await connection.query(`SELECT distinct bd_no from bookmark where id='${id}'`);

        //데이터가 0개면 바로 빠져나옴
        if(!bookmark_cnt[0].cnt){ 
            rs.code = 200;
            res.send(rs);
            return;
        }
        for(let i in bookmark_bd_no){
            bdno += bookmark_bd_no[i].bd_no+",";
        }
        bdno = bdno.slice(0,-1);


        //필터적용
        let filter="";
        filter = `hide=0 and bd_no in (${bdno})`;
        filter+=` ORDER BY reg_date DESC`;

        const [result] = await connection.query(`SELECT * from board where ${filter} ${paging}`); 
        //총 데이터 개수
        const data_cnt = await connection.query(`SELECT count(*) as cnt FROM board WHERE ${filter}`); 

        rs.code = 200;    
        rs.dbo = result;
        rs.data_cnt = data_cnt[0].cnt;
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

//채팅 입력
app.post('/chatWrite', async function(req, res) {  

    let connection;
    let rs = {};

    try {

        connection = await mysql.createConnection(dbConfig);

        const params={
            id : req.body.id,
            nickname: req.body.nickname,
            msg: req.body.msg,
            reg_date: moment().format('YYYY-MM-DD HH:mm:ss')
        }

        await connection.query(`
            INSERT INTO chat(
                id, nickname, msg, reg_date
            )VALUES (
                '${params.id}',
                '${params.nickname}',
                '${params.msg}',
                '${params.reg_date}'
            )
        `);

        pusher.trigger('my-channel', 'my-event', params);
        rs.code = 200;
        res.send(rs);

    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }

});

// 채팅내용 출력
app.post('/chatSel', async function(req, res) {   
    
    let connection;
    let rs = {};

    try {
        connection = await mysql.createConnection(dbConfig);

        const ChatLimitNum = req.body.ChatLimitNum;

        let [result] = await connection.query(`SELECT * from chat order by chatno DESC limit ${ChatLimitNum}`); 
        result = result.reverse();

        rs.code = 200;   
        rs.dbo = result;   
        res.send(rs);
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    }
});

app.listen(port);

