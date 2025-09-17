package vn.vnpay.rs.berps.controller;


import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController()
@RequestMapping("/v1/file")
public class FileController {
    @PostMapping(value ="/upload/chunk", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public boolean uploadChunk() {
        return true;
    }

    @PostMapping(value ="/upload/chunk/complete")
    public boolean uploadChunkComplete() {
        return true;
    }
}
