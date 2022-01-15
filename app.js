//const { response } = require('express');
const express = require('express'); //express를 설치했기 때문에 가져올 수 있다.
const app = express();
const port = 5000;
const oracledb = require('oracledb'); //오라클db 연동
const dbConfig = require('./dbConfig.js'); //오라클db 계정 정보
const cors = require('cors'); //post 요청받을시 cors에러 해결을 위한 라이브러리
const cookieParser = require('cookie-parser');
const session = require("express-session"); //세션모듈 가져오기
const multer = require('multer'); //이미지 업로드 모듈
const moment = require('moment'); //날짜 관련 포맷 모듈

app.use(cors());
app.use(express.json()); //express.js의 내장 body-parser적용 (req.body로 데이터 받을수 있음)
app.use(express.urlencoded( {extended : true } )); //extende : trud -> cors라이브러리 사용
app.use(cookieParser());
app.use(express.static('public')); //정적 파일 접근을 위해 사용 (업로드 되어진 이미지 보여주는 용도)

app.use(session({
	secret: 'session_cookie_name',
	resave: false,
	saveUninitialized: true
}));

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


oracledb.autoCommit = true; // Oracle Auto Commit 설정  (제어어 COMMIT)

/////////////////////////////////////////////////////////////////////////////////

//db연결해제
function doRelease(connection){
    connection.release(
        function(err) {
            if (err) {
                console.error(err.message);
            }
        }
    );
}


//////////////////////////////////////////////////////////////////////////////////
app.get('/', (req, res) => {
    res.send("404 not found ");
})

app.post('/test', (req, res) => {
    const rs = {};
    rs.dbo = {id : req.body.id , pwd : req.body.pwd , nickname : req.body.nickname};

    res.send(rs)
})

//회원정보
app.get('/sel', (req, res) => {

    oracledb.getConnection({
        user          : dbConfig.user,
        password      : dbConfig.password,
        connectString : dbConfig.connectString
    },
    function(err, connection){
        if (err) {
            let rs = {code : 404 , err : err};
            res.send(rs);
            return;
        }

        connection.execute(`SELECT * FROM member WHERE id = :user_id`,['testid'],  (err, result) => {      
            if (err) {
                doRelease(connection);
                let rs = {code : 500 , err : err};
                res.send(rs);
                return;
            }
            doRelease(connection);
            let rs = {};
            rs.code = 200;
            rs.dbo = result.rows;
            res.send(rs);
        });
    });
});

//회원가입
app.post('/join', async(req, res) => {
    let connection;
    let rs = {};
    try {     
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const id = req.body.id;
        const pwd = req.body.pwd;
        const nickname = req.body.nickname;

        const result = await connection.execute(
            `SELECT * FROM member WHERE id ='${id}'`,[],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        )

        if(result.rows.length){
            rs.code = 501;
            rs.msg = "사용중인 아이디가 있습니다.";          
            res.send(rs);
            return;
        }else{ 
            await connection.execute(`
                INSERT INTO member(
                    id, nickname, pwd
                )VALUES (
                    '${id}',
                    '${nickname}',
                    '${pwd}'
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
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//로그인
app.post('/login', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const id = req.body.id;
        const pwd = req.body.pwd;

        const result = await connection.execute(
            `SELECT * FROM member WHERE id ='${id}' and pwd = '${pwd}'`,[],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        )

        if(result.rows.length){
            req.session.user_id = id;
            rs.ssid = req.session.user_id;  
            rs.ssnickname = result.rows[0].NICKNAME;              
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
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
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
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const id = req.body.id;
        const nickname = req.body.nickname;
        const category = req.body.category;
        const subject = req.body.subject;
        const content = req.body.content;

        await connection.execute(`
            INSERT INTO board(
                bd_no, id, nickname, category, subject, content
            )VALUES (
                board_seq.nextval,
                '${id}',
                '${nickname}',
                '${category}',
                '${subject}',
                '${content}'
            )
        `)

        //등록한 글로 넘어가기 위한 bd_no 받아오기
        const myview = await connection.execute(
            `SELECT bd_no FROM board WHERE id='${id}' and subject='${subject}' and content='${content}' and ROWNUM = 1`,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        );   
        rs.bd_no=myview.rows[0].BD_NO;

        rs.code = 200;    
        res.send(rs);      
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//글 수정
app.post('/modify', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const bd_no = req.body.bd_no;
        const id = req.body.id;
        const nickname = req.body.nickname;
        const category = req.body.category;
        const subject = req.body.subject;
        const content = req.body.content;

        await connection.execute(`
            UPDATE board SET 
            nickname='${nickname}',
            category='${category}',
            subject='${subject}',
            content='${content}'
            WHERE bd_no =${bd_no} and id='${id}'
        `);

        rs.code = 200;    
        res.send(rs);      
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//글 삭제
app.post('/delete', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const id = req.body.id;
        const bd_no = req.body.bd_no;

        await connection.execute(
            ` DELETE FROM board WHERE bd_no=${bd_no} and id='${id}' `
        )
        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//글 목록
app.post('/boardList', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const category = req.body.category;
        const page = req.body.page;
        const sort = req.body.sort;
        const listNumber = req.body.listNumber;

        const startNum = page*listNumber-(listNumber-1); // 페이징 시작넘버
        const endNum = startNum+(listNumber-1); // 페이징 끝넘버
        const paging = `RNUM >= ${startNum} AND RNUM <= ${endNum}`

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

        const result = await connection.execute(
            `SELECT * FROM ( 
                SELECT A.*, 
                ROWNUM AS RNUM FROM (
                    SELECT * FROM board WHERE ${filter}
                ) A
            ) WHERE ${paging}`
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        )
        //총 데이터 개수
        const data_cnt = await connection.execute(`SELECT count(*) as cnt FROM board WHERE ${filter}` ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }); 
        rs.code = 200;    
        rs.dbo = result.rows;
        rs.data_cnt = data_cnt.rows[0].CNT;
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//해당 글 정보
app.post('/boardView', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const bd_no = req.body.bd_no;
        const id = req.body.id;

        //해당 글 정보
        const result = await connection.execute(
            `SELECT * FROM board WHERE bd_no=${bd_no}`
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        )

        //댓글 정보
        const reply = await connection.execute(
            `SELECT * FROM reply WHERE bd_no=${bd_no} and hide=0`
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        )

        //계정 기준 유저아이디 추천,비추천 개수
        const id_recomm = await connection.execute(
            `SELECT count(*) as cnt FROM recommend WHERE bd_no=${bd_no} and id='${id}'`
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        //즐겨찾기 유무 체크
        const bookmark = await connection.execute(
            `SELECT count(*) as cnt FROM bookmark WHERE bd_no=${bd_no} and id='${id}'`
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
          
        rs.code = 200;    
        rs.dbo = result.rows[0];  
        rs.reply = reply.rows;
        rs.id_recomm = id_recomm.rows[0].CNT;
        rs.bookmark = bookmark.rows[0].CNT;
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//추천,비추천
app.post('/recommend', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const id = req.body.id;
        const bd_no = req.body.bd_no;
        const classtype = req.body.classtype;

        await connection.execute(
            `INSERT INTO recommend (  
                rc_no,
                bd_no,
                id,
                classtype
            ) VALUES(
                recommend_seq.nextval,
                ${bd_no},
                '${id}',
                '${classtype}'
            )`
        )

        const rec_cnt = await connection.execute(
            `SELECT count(*) as cnt FROM recommend WHERE bd_no=${bd_no} and classtype='${classtype}'`
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        ); 

        if(classtype=="추천"){
            await connection.execute(`UPDATE board SET gets=${rec_cnt.rows[0].CNT} WHERE bd_no =${bd_no}`);
        }else{
            await connection.execute(`UPDATE board SET degets=${rec_cnt.rows[0].CNT} WHERE bd_no =${bd_no}`);
        }
        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//즐겨찾기 등록
app.post('/bookmark_ins', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const id = req.body.id;
        const bd_no = req.body.bd_no;

        await connection.execute(
            `INSERT INTO bookmark (  
                bm_no,
                bd_no,
                id
            ) VALUES(
                bookmark_seq.nextval,
                ${bd_no},
                '${id}'
            )`
        )
        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//즐겨찾기 삭제
app.post('/bookmark_del', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const id = req.body.id;
        const bd_no = req.body.bd_no;

        await connection.execute(
            ` DELETE FROM bookmark WHERE bd_no=${bd_no} and id='${id}' `
        )
        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//댓글 등록
app.post('/reply_ins', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const id = req.body.id;
        const nickname = req.body.nickname;
        const bd_no = req.body.bd_no;
        const content = req.body.content;

        await connection.execute(
            `INSERT INTO reply (  
                rp_no,
                bd_no,
                id,
                nickname,
                content
            ) VALUES(
                reply_seq.nextval,
                ${bd_no},
                '${id}',
                '${nickname}',
                '${content}'
            )`
        )

        //댓글 갯수 가져오기
        const rc_cnt = await connection.execute(
            `SELECT count(*) as cnt FROM reply WHERE hide=0 and bd_no=${bd_no}`
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        ); 
        //board 테이블 댓글수 업데이트
        await connection.execute(`UPDATE board SET comments=${rc_cnt.rows[0].CNT} WHERE bd_no =${bd_no}`);

        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//댓글 삭제
app.post('/reply_del', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const rp_no = req.body.rp_no;
        const bd_no = req.body.bd_no;
        const content = req.body.content;

        await connection.execute(
            `UPDATE reply SET hide=1 where rp_no = ${rp_no}`
        )

        //댓글 갯수 가져오기
        const rc_cnt = await connection.execute(
            `SELECT count(*) as cnt from reply WHERE hide=0 and bd_no=${bd_no}`
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        ); 
        //board 테이블 댓글수 업데이트
        await connection.execute(`UPDATE board SET comments=${rc_cnt.rows[0].CNT} WHERE bd_no =${bd_no}`);

        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//조회수 증가
app.post('/hitsUp', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const id = req.body.id;
        const bd_no = req.body.bd_no;
        const ip = req.body.ip;


        await connection.execute(
            `INSERT INTO hits (  
                hits_no,
                bd_no,
                id,
                ip
            ) VALUES(
                hits_seq.nextval,
                ${bd_no},
                '${id}',
                '${ip}'
            )`
        )

        //조회테이블 에서 갯수 가져오기
        const hits_cnt = await connection.execute(
            `SELECT count(*) as cnt from hits WHERE bd_no=${bd_no}`
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        ); 
        //board 테이블 조회수 업데이트
        await connection.execute(`UPDATE board SET hits=${hits_cnt.rows[0].CNT} WHERE bd_no =${bd_no}`);

        rs.code = 200;    
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//내가 쓴 글 리스트
app.post('/myWrite', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })

        const page = req.body.page;
        const listNumber = req.body.listNumber;
        const id = req.body.id;

        const startNum = page*listNumber-(listNumber-1); // 페이징 시작넘버
        const endNum = startNum+(listNumber-1); // 페이징 끝넘버
        const paging = `RNUM >= ${startNum} AND RNUM <= ${endNum}`

        //필터적용
        let filter="";
        filter = `hide=0 and id='${id}'`;
        filter+=` ORDER BY reg_date DESC`;


        const result = await connection.execute(
            `SELECT * FROM ( 
                SELECT A.*, 
                ROWNUM AS RNUM FROM (
                    SELECT * FROM board WHERE ${filter}
                ) A
            ) WHERE ${paging}`
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        )
        //총 데이터 개수
        const data_cnt = await connection.execute(`SELECT count(*) as cnt FROM board WHERE ${filter}` ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }); 
        rs.code = 200;    
        rs.dbo = result.rows;
        rs.data_cnt = data_cnt.rows[0].CNT;
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});

//즐겨찾기 리스트
app.post('/myBookmark', async(req, res) => {
    let connection;
    let rs = {};

    try {
        connection = await oracledb.getConnection({
            user          : dbConfig.user,
            password      : dbConfig.password,
            connectString : dbConfig.connectString
        })
        

        const page = req.body.page;
        const listNumber = req.body.listNumber;
        const id = req.body.id;

        const startNum = page*listNumber-(listNumber-1); // 페이징 시작넘버
        const endNum = startNum+(listNumber-1); // 페이징 끝넘버
        const paging = `RNUM >= ${startNum} AND RNUM <= ${endNum}`;
        let bdno = "";



        //와드 박은 데이터 갯수 가져오기
        const bookmark_cnt = await connection.execute(
            `SELECT distinct count(bd_no) as cnt from bookmark where id='${id}' `
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        //와드 박은 데이터 id_no 가져오기
        const bookmark_bd_no = await connection.execute(
            `SELECT distinct bd_no from bookmark where id='${id}'`
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        //데이터가 0개면 바로 빠져나옴
        if(!bookmark_cnt.rows[0].CNT){ 
            rs.code = 200;
            res.send(rs);
            return;
        }
        for(let i in bookmark_bd_no.rows){
            bdno += bookmark_bd_no.rows[i].BD_NO+",";
        }
        bdno = bdno.slice(0,-1);


        //필터적용
        let filter="";
        filter = `hide=0 and bd_no in (${bdno})`;
        filter+=` ORDER BY reg_date DESC`;


        const result = await connection.execute(
            `SELECT * FROM ( 
                SELECT A.*, 
                ROWNUM AS RNUM FROM (
                    SELECT * FROM board WHERE ${filter}
                ) A
            ) WHERE ${paging}`
            ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }
        )
        //총 데이터 개수
        const data_cnt = await connection.execute(`SELECT count(*) as cnt FROM board WHERE ${filter}` ,[],{ outFormat: oracledb.OUT_FORMAT_OBJECT }); 
        rs.code = 200;    
        rs.dbo = result.rows;
        rs.data_cnt = data_cnt.rows[0].CNT;
        res.send(rs);  
    } catch (err) {
        rs = {code : 500 , err : err};       
        res.send(rs);
        return;
    } finally {
        if (connection) {
            try {
                doRelease(connection);
            } catch (err) {
                console.log(err)
            }
        }
    }
});



app.listen(port)

